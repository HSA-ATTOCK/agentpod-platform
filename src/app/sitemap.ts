import type { MetadataRoute } from "next";

/** Public pages for search engines. Set NEXT_PUBLIC_SITE_URL to your live address. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/terms", "/privacy", "/sign-up", "/sign-in"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
