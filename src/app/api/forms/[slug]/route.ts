import { routes } from "@/config/routes";
import { sendEmail } from "@/lib/email/mailer";
import { babaNoticeEmail } from "@/lib/email/templates";
import { serverOrigin } from "@/lib/origin";
import { notifyInApp } from "@/lib/platform/account";
import { rateLimited } from "@/lib/rate-limit";
import { cleanFormFields, safeNextPage } from "@/lib/sites/forms";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * POST /api/forms/<slug> — receives a form on a website Baba built (preview or live).
 * Stores the submission for the site's workspace and tells its owners and admins.
 * Spam protection: a hidden "_gotcha" field must stay empty, and a rate limit per sender and site.
 * Controls: _form (form name), _next (page to show afterwards).
 */
function thanks(message: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center"><p>${message}</p></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]{16,40}$/.test(slug) || !isAdminConfigured()) return thanks("This form isn't available.", 404);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`form:${slug}:${ip}`, 5, 10 * 60_000) || rateLimited(`form:${slug}`, 200, 60 * 60_000)) {
    return thanks("Too many messages were sent. Please try again later.", 429);
  }

  let entries: [string, unknown][] = [];
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      entries = Object.entries((await request.json()) as Record<string, unknown>);
    } else {
      entries = [...(await request.formData()).entries()];
    }
  } catch {
    return thanks("That didn't work. Please try again.", 400);
  }
  const { data, controls } = cleanFormFields(entries);
  const db = getSupabaseAdmin();
  const { data: site } = await db.from("sites").select("id, workspace_id, name, status, production_url").eq("slug", slug).maybeSingle();
  if (!site || site.status === "disabled") return thanks("This form isn't available.", 404);

  const nextPage = safeNextPage(controls._next);
  const fromLive = site.production_url && (request.headers.get("origin") ?? "").length > 0 && site.production_url.startsWith(request.headers.get("origin")!);
  const redirect = nextPage ? `${fromLive ? site.production_url : `${serverOrigin()}/preview/${slug}`}/${nextPage}` : null;
  const done = () => (redirect ? Response.redirect(redirect, 303) : thanks("Thank you! Your message was sent."));

  // Bots fill every field, including the hidden one: pretend it worked
  if (controls._gotcha || Object.keys(data).length === 0) return done();

  await db.from("site_form_submissions").insert({
    site_id: site.id,
    workspace_id: site.workspace_id,
    form_name: (controls._form || "form").slice(0, 80),
    data: data as unknown as Json,
    page: request.headers.get("referer")?.slice(0, 300) ?? null,
  });

  // Tell the workspace's owners and admins
  const summary = Object.entries(data)
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const { data: managers } = await db.from("workspace_members").select("user_id").eq("workspace_id", site.workspace_id).in("role", ["owner", "admin"]);
  const ids = (managers ?? []).map((m) => m.user_id);
  const title = `New ${controls._form || "form"} message on ${site.name}`;
  await notifyInApp(ids.map((userId) => ({ userId, workspaceId: site.workspace_id, kind: "info" as const, title, body: summary, link: routes.sites })));
  const { data: people } = ids.length ? await db.from("profiles").select("email").in("id", ids) : { data: [] };
  await Promise.all((people ?? []).map((p) => sendEmail(babaNoticeEmail({ to: p.email, title, message: summary, url: `${serverOrigin()}${routes.sites}` }))));
  return done();
}
