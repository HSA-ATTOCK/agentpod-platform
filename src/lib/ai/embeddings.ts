import "server-only";

/**
 * Embeddings for "search by meaning" (PRD §13), behind one small provider-independent
 * interface. Configure ONE of:
 *   OPENAI_API_KEY   (text-embedding-3-small, shortened to 1024 numbers)
 *   VOYAGE_API_KEY   (voyage-3.5, 1024 numbers)
 * EMBEDDINGS_PROVIDER=openai|voyage picks one when both are set.
 */

export const EMBEDDING_DIMENSIONS = 1024;
type Provider = "openai" | "voyage";

export function embeddingsProvider(): Provider | null {
  const wanted = process.env.EMBEDDINGS_PROVIDER;
  if (wanted === "voyage" && process.env.VOYAGE_API_KEY) return "voyage";
  if (wanted === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.VOYAGE_API_KEY) return "voyage";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Embeds up to 64 texts; "query" vs "document" matters for some providers. */
export async function embed(texts: string[], kind: "query" | "document"): Promise<number[][]> {
  const provider = embeddingsProvider();
  if (!provider) throw new Error("No embeddings provider is configured.");
  const input = texts.map((t) => t.slice(0, 8000));
  const res =
    provider === "openai"
      ? await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input, dimensions: EMBEDDING_DIMENSIONS }),
        })
      : await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "voyage-3.5", input, input_type: kind, output_dimension: EMBEDDING_DIMENSIONS }),
        });
  const data = (await res.json().catch(() => ({}))) as { data?: { embedding: number[]; index: number }[]; error?: { message?: string } | string; detail?: string };
  if (!res.ok || !data.data) {
    const message = typeof data.error === "string" ? data.error : (data.error?.message ?? data.detail ?? res.status);
    throw new Error(`Embeddings failed: ${message}`);
  }
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** pgvector's text format: [0.1,0.2,…] */
export const toVector = (values: number[]) => `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
