import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { routes } from "@/config/routes";

/** Public pages for search engines, on the address the site is served from. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  const pages = [
    routes.home,
    routes.features,
    routes.aiAgents,
    routes.connections,
    routes.useCases,
    routes.pricing,
    routes.about,
    routes.contact,
    routes.terms,
    routes.privacy,
    routes.signUp,
    routes.signIn,
  ].map((path) => (path === routes.home ? "" : path));
  return pages.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
