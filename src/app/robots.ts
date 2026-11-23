import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/** Let search engines index the public pages only. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/terms", "/privacy", "/sign-in", "/sign-up"],
      disallow: ["/api/", "/auth/", "/ask", "/dashboard", "/agents", "/workflows", "/projects", "/integrations", "/activity", "/settings", "/profile"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
