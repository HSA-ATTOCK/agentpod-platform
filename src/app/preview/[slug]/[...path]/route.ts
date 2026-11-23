import { servePreview } from "@/lib/sites/serve";

/** GET /preview/<slug>/<path> — one file of a website preview (see src/lib/sites/serve.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  return servePreview(slug, path);
}
