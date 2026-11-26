import "server-only";
import { embed, embeddingsProvider, toVector } from "@/lib/ai/embeddings";
import type { AppContext } from "@/lib/data/context";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Business memory and knowledge base (PRD §13).
 * - Memory: short facts about the business (brand, products, audience, policies, style) that
 *   Baba reuses instead of asking again. Facts Baba suggests are marked "suggested" until a
 *   person confirms them, so assumptions are never treated as verified.
 * - Knowledge base: documents split into chunks and searched with Postgres full-text search,
 *   always inside the workspace (Row Level Security).
 */

export const MEMORY_CATEGORIES = ["company", "brand", "products", "audience", "policy", "style", "fact", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const CHUNK = 1500;
const OVERLAP = 200;
export const MAX_DOCUMENT_CHARS = 2_000_000;

export async function listMemory(ctx: AppContext) {
  const { data } = await ctx.supabase
    .from("memory_entries")
    .select("id, category, content, source, created_at, updated_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("category")
    .order("created_at");
  return data ?? [];
}

export async function memoryText(ctx: AppContext) {
  const rows = await listMemory(ctx);
  if (rows.length === 0) return "Business memory is empty.";
  return rows.map((r) => `- [${r.category}] ${r.content}${r.source === "baba" ? " (suggested by Baba, not confirmed)" : ""} (id ${r.id})`).join("\n");
}

export async function saveMemory(ctx: AppContext, input: { category: string; content: string; source: "user" | "baba"; id?: string }) {
  const category = (MEMORY_CATEGORIES as readonly string[]).includes(input.category) ? input.category : "fact";
  const content = input.content.trim().slice(0, 2000);
  if (!content) throw new Error("Nothing to remember.");
  if (input.id) {
    const { error } = await ctx.supabase
      .from("memory_entries")
      .update({ category, content, source: input.source })
      .eq("id", input.id)
      .eq("workspace_id", ctx.workspace.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await ctx.supabase
    .from("memory_entries")
    .insert({ workspace_id: ctx.workspace.id, category, content, source: input.source, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteMemory(ctx: AppContext, id: string) {
  const { data, error } = await ctx.supabase.from("memory_entries").delete().eq("id", id).eq("workspace_id", ctx.workspace.id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("That memory wasn't found.");
}

/** Splits text into overlapping chunks, preferring paragraph breaks. */
export function chunkText(text: string) {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + CHUNK);
    if (end < clean.length) {
      const para = clean.lastIndexOf("\n\n", end);
      const sentence = clean.lastIndexOf(". ", end);
      if (para > start + CHUNK / 2) end = para;
      else if (sentence > start + CHUNK / 2) end = sentence + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - OVERLAP, start + 1);
  }
  return chunks.filter(Boolean);
}

export async function addDocument(ctx: AppContext, input: { title: string; text: string; fileName?: string; mimeType?: string }) {
  const title = input.title.trim().slice(0, 200) || input.fileName || "Untitled";
  const text = input.text.slice(0, MAX_DOCUMENT_CHARS);
  if (!text.trim()) throw new Error("The document has no text.");
  const chunks = chunkText(text);
  const { data: doc, error } = await ctx.supabase
    .from("knowledge_documents")
    .insert({
      workspace_id: ctx.workspace.id,
      title,
      file_name: input.fileName ?? null,
      mime_type: input.mimeType ?? null,
      char_count: text.length,
      chunk_count: chunks.length,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  for (let i = 0; i < chunks.length; i += 200) {
    const { error: chunkError } = await ctx.supabase.from("knowledge_chunks").insert(
      chunks.slice(i, i + 200).map((content, j) => ({ document_id: doc.id, workspace_id: ctx.workspace.id, position: i + j, content })),
    );
    if (chunkError) {
      await ctx.supabase.from("knowledge_documents").delete().eq("id", doc.id);
      throw new Error(chunkError.message);
    }
  }
  // Index for search by meaning (if configured); a failure here leaves keyword search working
  await embedMissingChunks(ctx.workspace.id, 400).catch((error) => console.error("[knowledge] embeddings:", error instanceof Error ? error.message : error));
  return { id: doc.id, chunks: chunks.length };
}

/** Adds embeddings to passages that don't have one yet (new documents, or ones added before a provider was set). */
export async function embedMissingChunks(workspaceId: string, limit = 200) {
  if (!embeddingsProvider() || !isAdminConfigured()) return 0;
  const db = getSupabaseAdmin();
  const { data } = await db.from("knowledge_chunks").select("id, content").eq("workspace_id", workspaceId).is("embedding", null).order("id").limit(limit);
  const rows = data ?? [];
  for (let i = 0; i < rows.length; i += 64) {
    const batch = rows.slice(i, i + 64);
    const vectors = await embed(batch.map((r) => r.content), "document");
    await Promise.all(batch.map((r, j) => db.from("knowledge_chunks").update({ embedding: toVector(vectors[j]) }).eq("id", r.id).eq("workspace_id", workspaceId)));
  }
  return rows.length;
}

export async function deleteDocument(ctx: AppContext, id: string) {
  const { data, error } = await ctx.supabase.from("knowledge_documents").delete().eq("id", id).eq("workspace_id", ctx.workspace.id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("That document wasn't found (or only its owner or an admin can delete it).");
}

export async function listDocuments(ctx: AppContext) {
  const { data } = await ctx.supabase
    .from("knowledge_documents")
    .select("id, title, file_name, char_count, chunk_count, created_at, created_by")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

type Passage = { key: string; title: string; position: number; content: string };

/** Search by meaning (when an embeddings provider is configured). */
async function semanticPassages(ctx: AppContext, q: string, limit: number): Promise<Passage[]> {
  if (!embeddingsProvider()) return [];
  try {
    await embedMissingChunks(ctx.workspace.id, 200);
    const [vector] = await embed([q], "query");
    const { data } = await ctx.supabase.rpc("match_knowledge_chunks", { ws: ctx.workspace.id, query_embedding: toVector(vector), match_count: limit });
    const rows = (data ?? []).filter((r) => r.similarity > 0.25);
    if (!rows.length) return [];
    const { data: docs } = await ctx.supabase.from("knowledge_documents").select("id, title").in("id", [...new Set(rows.map((r) => r.document_id))]);
    const title = new Map((docs ?? []).map((d) => [d.id, d.title]));
    return rows.map((r) => ({ key: `${r.document_id}:${r.chunk_position}`, title: title.get(r.document_id) ?? "Document", position: r.chunk_position, content: r.content }));
  } catch (error) {
    console.error("[knowledge] semantic search:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** The knowledge_search tool: meaning-based and keyword results combined. */
export async function searchKnowledge(ctx: AppContext, query: string, limit = 8) {
  const q = query.trim().slice(0, 300);
  if (!q) return "Give a search query.";
  const max = Math.min(20, Math.max(1, limit));
  const semantic = await semanticPassages(ctx, q, max);
  const { data, error } = await ctx.supabase
    .from("knowledge_chunks")
    .select("content, position, document_id, knowledge_documents (title)")
    .eq("workspace_id", ctx.workspace.id)
    .textSearch("search", q, { type: "websearch", config: "simple" })
    .limit(max);
  if (error && !semantic.length) return `Search failed: ${error.message}`;
  const keyword: Passage[] = (data ?? []).map((c) => ({
    key: `${c.document_id}:${c.position}`,
    title: (c.knowledge_documents as { title?: string } | null)?.title ?? "Document",
    position: c.position,
    content: c.content,
  }));
  // Interleave both lists, without duplicates
  const merged: Passage[] = [];
  const seen = new Set<string>();
  for (let i = 0; merged.length < max && (i < semantic.length || i < keyword.length); i++) {
    for (const p of [semantic[i], keyword[i]]) {
      if (p && !seen.has(p.key) && merged.length < max) {
        seen.add(p.key);
        merged.push(p);
      }
    }
  }
  if (!merged.length) {
    const { count } = await ctx.supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id);
    return count ? `No passages matched "${q}". Try other words (exact terms work best).` : "The knowledge base is empty. The user can add documents on the Memory page.";
  }
  return merged.map((p) => `### ${p.title} (part ${p.position + 1})\n${p.content}`).join("\n\n---\n\n");
}

/** Business memory, added to the first message of each conversation (confirmed facts and suggestions marked). */
export async function memoryForPrompt(supabase: AppContext["supabase"], workspaceId: string) {
  const { data } = await supabase.from("memory_entries").select("category, content, source").eq("workspace_id", workspaceId).order("category").limit(200);
  if (!data?.length) return "";
  const lines = data.map((m) => `- [${m.category}] ${m.content}${m.source === "baba" ? " (unconfirmed)" : ""}`);
  let text = lines.join("\n");
  if (text.length > 8000) text = `${text.slice(0, 8000)}\n- … (more in memory: use memory_list)`;
  return text;
}
