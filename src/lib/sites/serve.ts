import "server-only";
import { readSiteFile } from "./sites";

/**
 * GET /preview/<slug>/<path> (and /preview/<slug> for the home page, see ../route.ts) — serves a website preview built by Baba.
 * Anyone with the (unguessable) link can view it, like a share link.
 * The CSP "sandbox" gives the page its own opaque origin, so its scripts can't read
 * this app's cookies or storage, can't submit forms and can't call other servers.
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "sandbox allow-scripts allow-popups allow-modals allow-forms; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, max-age=30",
};

export async function servePreview(slug: string, path: string[]) {
  const file = await readSiteFile(slug, path.map(decodeURIComponent).join("/"));
  if (!file) {
    return new Response("This preview doesn't exist, was switched off or has expired.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
    });
  }
  // HTML pages get a <base> so relative links resolve inside the site (Next.js drops trailing slashes)
  if (file.type.startsWith("text/html")) {
    const html = await file.body.text();
    const base = `<base href="/preview/${slug}/">`;
    const withBase = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${html}`;
    return new Response(withBase, { status: file.status ?? 200, headers: { "Content-Type": file.type, ...SECURITY_HEADERS } });
  }
  return new Response(file.body, { status: file.status ?? 200, headers: { "Content-Type": file.type, ...SECURITY_HEADERS } });
}
