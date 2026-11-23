import type { MetadataRoute } from "next";

/** Let search engines index the public pages only. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/terms", "/privacy", "/sign-in", "/sign-up"],
      disallow: ["/api/", "/auth/", "/ask", "/dashboard", "/agents", "/workflows", "/projects", "/integrations", "/activity", "/settings", "/profile"],
    },
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
