import "server-only";
import { randomBytes } from "node:crypto";
import { unzipSync } from "fflate";
import { getClaude } from "@/lib/baba/server";
import type { AppContext } from "@/lib/data/context";
import { serverOrigin } from "@/lib/origin";
import { audit } from "@/lib/platform/account";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Website previews (PRD §9): the Website Builder zips a static site into the session's
 * outputs; we unpack it, keep every version in the private "sites" bucket, and serve the
 * current version at /preview/<random-slug>/ (see src/app/preview). Previews are isolated
 * from the app: they're served with a sandboxing Content-Security-Policy, so the site's
 * scripts can't read the app's cookies or data.
 */

const BUCKET = "sites";
const MAX_FILES = 400;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
  webmanifest: "application/manifest+json",
};

export const contentTypeFor = (path: string) => CONTENT_TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;

export const previewUrl = (slug: string) => `${serverOrigin()}/preview/${slug}/`;

/** Safe relative path inside the site, or null. */
function cleanPath(raw: string) {
  const path = raw.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!path || path.startsWith("/") || path.split("/").some((part) => part === ".." || part === "") || path.includes("\0")) return null;
  if (path.startsWith("__MACOSX/") || path.split("/").pop()!.startsWith(".")) return null;
  return path;
}

type SiteFile = { path: string; bytes: Uint8Array; type: string };

function unpack(zip: Uint8Array): SiteFile[] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, { filter: (f) => !f.name.endsWith("/") && f.originalSize <= MAX_FILE_BYTES });
  } catch {
    throw new Error("The zip file couldn't be opened.");
  }
  let files = Object.entries(entries)
    .map(([name, bytes]) => ({ path: cleanPath(name), bytes }))
    .filter((f): f is { path: string; bytes: Uint8Array } => f.path !== null);
  // A zip with everything inside one folder: use that folder as the site root
  if (!files.some((f) => f.path === "index.html")) {
    const roots = new Set(files.map((f) => f.path.split("/")[0]));
    if (roots.size === 1) {
      const root = [...roots][0];
      if (files.some((f) => f.path === `${root}/index.html`)) files = files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) }));
    }
  }
  if (!files.some((f) => f.path === "index.html")) throw new Error("The site has no index.html at the top of the zip.");
  if (files.length > MAX_FILES) throw new Error(`The site has too many files (max ${MAX_FILES}).`);
  const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error("The site is too large for a preview (max 25 MB).");
  const result: SiteFile[] = [];
  for (const f of files) {
    const type = contentTypeFor(f.path);
    if (type) result.push({ ...f, type }); // skip unknown file types (e.g. server code)
  }
  return result;
}

export type PublishInput = { zipName: string; siteName?: string; siteId?: string; note?: string };

/** The site_publish_preview tool. */
export async function publishSitePreview(ctx: AppContext, scope: { sessionId: string; conversationId: string }, input: PublishInput) {
  const db = getSupabaseAdmin();
  const zipName = input.zipName.split("/").pop()!.trim();
  if (!zipName.toLowerCase().endsWith(".zip")) throw new Error("Give the zip file name from /mnt/session/outputs/, e.g. acme-site.zip.");

  // The zip the agents saved in this conversation's outputs
  const claude = getClaude();
  const files = await claude.beta.files.list({ scope_id: scope.sessionId, betas: ["managed-agents-2026-04-01"] });
  const zipFile = files.data.filter((f) => f.filename === zipName).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!zipFile) {
    throw new Error(`No file called "${zipName}" in this conversation's outputs. Files there: ${files.data.map((f) => f.filename).join(", ") || "none yet"}.`);
  }
  const download = await claude.beta.files.download(zipFile.id);
  const siteFiles = unpack(new Uint8Array(await download.arrayBuffer()));

  // Existing site (a new version) or a new one
  let site: { id: string; slug: string; name: string } | null = null;
  if (input.siteId) {
    const { data } = await db.from("sites").select("id, slug, name").eq("id", input.siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
    if (!data) throw new Error("That site wasn't found in this workspace. Leave site_id out to create a new preview.");
    site = data;
  } else {
    // Same conversation + same zip name = same site
    const { data } = await db
      .from("sites")
      .select("id, slug, name")
      .eq("workspace_id", ctx.workspace.id)
      .eq("conversation_id", scope.conversationId)
      .eq("name", (input.siteName || zipName.replace(/(-site)?\.zip$/i, "")).slice(0, 100))
      .maybeSingle();
    site = data;
  }
  if (!site) {
    const max = ctx.workspace.limits.maxPreviews;
    if (max !== null) {
      const { count } = await db.from("sites").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).neq("status", "disabled");
      if ((count ?? 0) >= max) throw new Error(`This workspace's plan allows ${max} website preview(s). Delete an old one on the Websites page first.`);
    }
    const { data, error } = await db
      .from("sites")
      .insert({
        workspace_id: ctx.workspace.id,
        conversation_id: scope.conversationId,
        name: (input.siteName || zipName.replace(/(-site)?\.zip$/i, "")).slice(0, 100),
        slug: randomBytes(12).toString("hex"),
        created_by: ctx.user.id,
      })
      .select("id, slug, name")
      .single();
    if (error || !data) throw new Error(`Couldn't create the site: ${error?.message}`);
    site = data;
  }

  const { data: last } = await db.from("site_versions").select("version").eq("site_id", site.id).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;

  for (const file of siteFiles) {
    const { error } = await db.storage.from(BUCKET).upload(`${site.id}/v${version}/${file.path}`, file.bytes, { contentType: file.type, upsert: true });
    if (error) throw new Error(`Couldn't store ${file.path}: ${error.message}`);
  }
  const totalBytes = siteFiles.reduce((s, f) => s + f.bytes.byteLength, 0);
  const { error: versionError } = await db.from("site_versions").insert({
    site_id: site.id,
    workspace_id: ctx.workspace.id,
    version,
    file_count: siteFiles.length,
    total_bytes: totalBytes,
    files: siteFiles.map((f) => f.path) as unknown as Json,
    note: input.note?.slice(0, 500) || null,
    created_by: ctx.user.id,
  });
  if (versionError) throw new Error(`Couldn't save the version: ${versionError.message}`);
  await db
    .from("sites")
    .update({ current_version: version, status: "preview", expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq("id", site.id);
  await audit({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    workspaceId: ctx.workspace.id,
    action: "site.preview_published",
    targetType: "site",
    targetId: site.id,
    details: { version, files: siteFiles.length, bytes: totalBytes },
  });

  return {
    url: previewUrl(site.slug),
    siteId: site.id,
    version,
    files: siteFiles.map((f) => f.path),
    name: site.name,
  };
}

/** Makes an older version the live one on the preview link (rollback). */
export async function restoreSiteVersion(ctx: AppContext, siteId: string, version: number) {
  const db = getSupabaseAdmin();
  const { data: v } = await db.from("site_versions").select("version").eq("site_id", siteId).eq("workspace_id", ctx.workspace.id).eq("version", version).maybeSingle();
  if (!v) throw new Error("That version wasn't found.");
  const { error } = await db.from("sites").update({ current_version: version }).eq("id", siteId).eq("workspace_id", ctx.workspace.id);
  if (error) throw new Error(error.message);
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.version_restored", targetType: "site", targetId: siteId, details: { version } });
}

export async function setSiteStatus(ctx: AppContext, siteId: string, status: "preview" | "disabled") {
  const { error } = await getSupabaseAdmin().from("sites").update({ status }).eq("id", siteId).eq("workspace_id", ctx.workspace.id);
  if (error) throw new Error(error.message);
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: status === "disabled" ? "site.disabled" : "site.enabled", targetType: "site", targetId: siteId });
}

export async function deleteSite(ctx: AppContext, siteId: string) {
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id").eq("id", siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!site) throw new Error("Site not found.");
  // Remove the stored files (all versions), then the records
  const { data: versions } = await db.from("site_versions").select("version, files").eq("site_id", siteId);
  for (const v of versions ?? []) {
    const paths = ((v.files as string[]) ?? []).map((p) => `${siteId}/v${v.version}/${p}`);
    for (let i = 0; i < paths.length; i += 100) await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
  await db.from("sites").delete().eq("id", siteId);
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.deleted", targetType: "site", targetId: siteId });
}

export async function listSitesText(ctx: AppContext) {
  const { data } = await getSupabaseAdmin()
    .from("sites")
    .select("id, name, slug, current_version, status, created_at, site_versions (version, note, created_at)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (!data?.length) return "No websites yet.";
  return data
    .map((s) => {
      const versions = (s.site_versions ?? []).sort((a, b) => b.version - a.version);
      return `- ${s.name} (site_id ${s.id}) — ${s.status === "disabled" ? "switched off" : previewUrl(s.slug)} — live version ${s.current_version ?? "none"}; versions: ${versions
        .map((v) => `v${v.version}${v.note ? ` (${v.note})` : ""}`)
        .join(", ")}`;
    })
    .join("\n");
}

/** Reads one file of the live version (for the preview route). */
export async function readSiteFile(slug: string, path: string) {
  if (!/^[a-z0-9]{16,40}$/.test(slug)) return null;
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, current_version, status, expires_at").eq("slug", slug).maybeSingle();
  if (!site || site.status === "disabled" || !site.current_version || Date.parse(site.expires_at) < Date.now()) return null;
  const clean = cleanPath(path || "index.html");
  if (!clean) return null;
  const candidates = clean.endsWith("/") ? [`${clean}index.html`] : contentTypeFor(clean) ? [clean] : [`${clean}.html`, `${clean}/index.html`];
  for (const candidate of candidates) {
    const { data } = await db.storage.from(BUCKET).download(`${site.id}/v${site.current_version}/${candidate}`);
    if (data) return { body: data, type: contentTypeFor(candidate) ?? "application/octet-stream" };
  }
  const { data: notFound } = await db.storage.from(BUCKET).download(`${site.id}/v${site.current_version}/404.html`);
  return notFound ? { body: notFound, type: "text/html; charset=utf-8", status: 404 } : null;
}
