import "server-only";
import type { Conversation } from "@/types/chat";
import type { AppContext } from "./context";

/** The workspace's most recent conversations (messages load when one is opened). */
export async function listConversations(ctx: AppContext, limit = 50): Promise<Conversation[]> {
  const { data, error } = await ctx.supabase
    .from("conversations")
    .select("id, title, updated_at, claude_session_id, cost_cents, cap_cents, paused")
    .eq("workspace_id", ctx.workspace.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Couldn't load conversations: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    sessionId: row.claude_session_id ?? undefined,
    cost: row.claude_session_id ? { cents: row.cost_cents, capCents: row.cap_cents } : undefined,
    paused: row.paused,
    tools: [],
    items: [],
    loaded: false,
  }));
}
