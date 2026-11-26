import "server-only";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppContext } from "@/lib/data/context";
import { audit } from "@/lib/platform/account";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { serverOrigin } from "@/lib/origin";
import { withFormEndpoint } from "./forms";
import { contentTypeFor } from "./sites";

/**
 * Production publishing (PRD §9): copies one version of a site to S3 under "<slug>/" and
 * refreshes CloudFront, so it's live at https://<slug>.<SITES_PUBLIC_DOMAIN>.
 * The CloudFront distribution (see infrastructure/terraform) maps each subdomain to its folder.
 * Needs: AWS_REGION, SITES_S3_BUCKET,
 * SITES_CLOUDFRONT_DISTRIBUTION_ID and SITES_PUBLIC_DOMAIN, plus AWS credentials (IAM role or keys).
 * Publishing always needs approval.
 */

export function isProductionConfigured() {
  // AWS credentials come from the standard places: the container's IAM role on AWS (no keys),
  // or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY elsewhere
  return Boolean(
    process.env.AWS_REGION &&
      process.env.SITES_S3_BUCKET &&
      process.env.SITES_CLOUDFRONT_DISTRIBUTION_ID &&
      process.env.SITES_PUBLIC_DOMAIN,
  );
}

export const productionUrl = (slug: string) => `https://${slug}.${process.env.SITES_PUBLIC_DOMAIN}`;

const CACHE: Record<string, string> = { html: "public, max-age=60", xml: "public, max-age=300" };

/** Publishes `version` (default: the version live on the preview link). Returns the live URL. */
export async function publishProduction(ctx: AppContext, siteId: string, version?: number) {
  if (!isProductionConfigured()) {
    throw new Error("Publishing to a real domain isn't set up on this server yet (it needs an AWS account). The preview link keeps working.");
  }
  if (ctx.workspace.role !== "owner" && ctx.workspace.role !== "admin") throw new Error("Only workspace owners and admins can publish a website.");
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, slug, name, current_version, status").eq("id", siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!site) throw new Error("That site wasn't found.");
  const v = version ?? site.current_version;
  const { data: ver } = await db.from("site_versions").select("version, files").eq("site_id", site.id).eq("version", v ?? -1).maybeSingle();
  if (!ver) throw new Error("That version wasn't found.");

  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const bucket = process.env.SITES_S3_BUCKET!;
  const files = (ver.files as string[]) ?? [];
  for (const path of files) {
    const { data } = await db.storage.from("sites").download(`${site.id}/v${ver.version}/${path}`);
    if (!data) throw new Error(`File ${path} is missing from version ${ver.version}.`);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${site.slug}/${path}`,
        // HTML forms post back to Baba (absolute address: the live site is on another domain)
        Body: /\.html?$/i.test(path) ? withFormEndpoint(await data.text(), `${serverOrigin()}/api/forms/${site.slug}`) : new Uint8Array(await data.arrayBuffer()),
        ContentType: contentTypeFor(path) ?? "application/octet-stream",
        CacheControl: CACHE[ext] ?? "public, max-age=86400",
      }),
    );
  }
  const cloudfront = new CloudFrontClient({ region: process.env.AWS_REGION });
  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: process.env.SITES_CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: { CallerReference: `${site.id}-${ver.version}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${site.slug}/*`] } },
    }),
  );
  const url = productionUrl(site.slug);
  await db
    .from("sites")
    .update({ production_version: ver.version, production_url: url, published_at: new Date().toISOString(), status: "preview" })
    .eq("id", site.id);
  await audit({
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    workspaceId: ctx.workspace.id,
    action: "site.published_production",
    targetType: "site",
    targetId: site.id,
    details: { version: ver.version, files: files.length, url },
  });
  return { url, version: ver.version, name: site.name };
}

/** Saves the customer's own domain and returns the DNS steps (the admin adds it to CloudFront). */
export async function requestCustomDomain(ctx: AppContext, siteId: string, domain: string) {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(clean)) throw new Error("That isn't a valid domain (e.g. www.example.com).");
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, slug").eq("id", siteId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!site) throw new Error("That site wasn't found.");
  await db.from("sites").update({ custom_domain: clean }).eq("id", site.id);
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "site.custom_domain_requested", targetType: "site", targetId: site.id, details: { domain: clean } });
  return `At your domain provider, add a CNAME record for ${clean} pointing to ${site.slug}.${process.env.SITES_PUBLIC_DOMAIN ?? "<sites domain>"}. Our team then adds the domain and its HTTPS certificate on our side (usually within one working day).`;
}
