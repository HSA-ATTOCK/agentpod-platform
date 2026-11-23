import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/** Public pages for search engines, on the address the site is served from. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  return ["", "/terms", "/privacy", "/sign-up", "/sign-in"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
