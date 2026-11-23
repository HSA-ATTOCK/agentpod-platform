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

/**
 * The public address when there's no request to look at (background jobs such as
 * scheduled workflows): NEXT_PUBLIC_SITE_URL, else the Codespaces forwarded address,
 * else Vercel's address, else localhost.
 */
export function serverOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const port = process.env.PORT || "3000";
  const codespace = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespace && forwardingDomain) return `https://${codespace}-${port}.${forwardingDomain}`;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return `http://localhost:${port}`;
}

/** An absolute URL on the public address, e.g. publicUrl(request, "/sign-in"). */
export function publicUrl(request: Request, path: string) {
  return new URL(path, publicOrigin(request));
}
