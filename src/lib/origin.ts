/**
 * The address people actually use to reach the app (e.g. the Codespaces or live domain),
 * not the internal localhost:3000 the server listens on behind a proxy.
 * Order: NEXT_PUBLIC_SITE_URL → the proxy's x-forwarded-host → the request's own URL.
 */
export function publicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/** An absolute URL on the public address, e.g. publicUrl(request, "/sign-in"). */
export function publicUrl(request: Request, path: string) {
  return new URL(path, publicOrigin(request));
}
