import "server-only";
import { withFormEndpoint } from "./forms";
import { readSiteFile } from "./sites";

/**
 * GET /preview/<slug>/<path> (and /preview/<slug> for the home page, see ../route.ts) — serves a website preview built by Baba.
 * Anyone with the (unguessable) link can view it, like a share link.
 * The CSP "sandbox" gives the page its own opaque origin, so its scripts can't read
 * this app's cookies or storage and can't call other servers (connect-src 'none').
 * Forms may only post back here (form-action 'self'), to the site's form endpoint.
 * Because previews live on Baba's own address, every page gets a visible "preview" banner
 * so a page imitating a sign-in screen is easy to spot (see docs/SECURITY_GUIDELINES.md).
 */

const PREVIEW_BANNER =
  '<div role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#111827;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:6px 12px;text-align:center">Website preview made with Baba. Never enter your Baba password or payment details on this page.</div>';

function withBanner(html: string) {
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${PREVIEW_BANNER}</body>`) : `${html}${PREVIEW_BANNER}`;
}
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "sandbox allow-scripts allow-popups allow-modals allow-forms; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, max-age=30",
};

export async function servePreview(slug: string, path: string[]) {
  const file = await readSiteFile(slug, path.map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return "\u0000"; // invalid encoding: cleanPath refuses it (404)
    }
  }).join("/"));
  if (!file) {
    return new Response("This preview doesn't exist, was switched off or has expired.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
    });
  }
  // HTML pages get a <base> so relative links resolve inside the site (Next.js drops trailing slashes)
  if (file.type.startsWith("text/html")) {
    // Forms post to Baba's form endpoint for this site
    const html = withBanner(withFormEndpoint(await file.body.text(), `/api/forms/${slug}`));
    const base = `<base href="/preview/${slug}/">`;
    const withBase = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${html}`;
    return new Response(withBase, { status: file.status ?? 200, headers: { "Content-Type": file.type, ...SECURITY_HEADERS } });
  }
  return new Response(file.body, { status: file.status ?? 200, headers: { "Content-Type": file.type, ...SECURITY_HEADERS } });
}
