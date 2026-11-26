import { servePreview } from "@/lib/sites/serve";

/** GET /preview/<slug> — the preview's home page (index.html). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return servePreview(slug, []);
}
