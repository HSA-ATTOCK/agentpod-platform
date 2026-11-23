import { readSiteFile } from "@/lib/sites/sites";

/**
 * GET /preview/<slug>/<path> — serves a website preview built by Baba.
 * Anyone with the (unguessable) link can view it, like a share link.
 * The CSP "sandbox" gives the page its own opaque origin, so its scripts can't read
 * this app's cookies or storage, can't submit forms and can't call other servers.
 */
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "sandbox allow-scripts allow-popups allow-modals allow-forms; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "private, max-age=30",
};

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await params;
  // /preview/<slug> without the trailing slash: redirect so relative links work
  const url = new URL(request.url);
  if (!path?.length && !url.pathname.endsWith("/")) {
    return new Response(null, { status: 308, headers: { Location: `${url.pathname}/` } });
  }
  const file = await readSiteFile(slug, (path ?? []).map(decodeURIComponent).join("/"));
  if (!file) {
    return new Response("This preview doesn't exist, was switched off or has expired.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
    });
  }
  return new Response(file.body, { status: file.status ?? 200, headers: { "Content-Type": file.type, ...SECURITY_HEADERS } });
}
