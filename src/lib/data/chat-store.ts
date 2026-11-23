"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import type { ChatItem, Conversation } from "@/types/chat";

/**
 * Saving and loading Ask Baba conversations from the browser.
 * Runs as the signed-in user; Row Level Security keeps each workspace's chats private.
 */

export async function createConversation(input: { id: string; workspaceId: string; userId: string; title: string }) {
  const { error } = await getSupabaseBrowser().from("conversations").insert({
    id: input.id,
    workspace_id: input.workspaceId,
    created_by: input.userId,
    title: input.title,
  });
  if (error) throw new Error("Couldn't start a new conversation. Please try again.");
}

export async function loadConversationItems(conversationId: string): Promise<ChatItem[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("conversation_items")
    .select("data")
    .eq("conversation_id", conversationId)
    .order("position", { ascending: true });
  if (error) throw new Error("Couldn't load this conversation.");
  return data.map((row) => row.data as unknown as ChatItem);
}

/** Inserts new items and updates changed ones (matched by the item's own id). */
export async function saveConversationItems(conversationId: string, workspaceId: string, items: ChatItem[]) {
  if (items.length === 0) return;
  const { error } = await getSupabaseBrowser()
    .from("conversation_items")
    .upsert(
      items.map((item) => ({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        client_id: item.id,
        type: item.type,
        data: item as unknown as Json,
      })),
      { onConflict: "conversation_id,client_id" },
    );
  if (error) throw new Error(error.message);
}

export async function renameConversation(conversationId: string, title: string) {
  const { error } = await getSupabaseBrowser().from("conversations").update({ title }).eq("id", conversationId);
  if (error) throw new Error("Couldn't rename the conversation.");
}

export async function deleteConversation(conversationId: string) {
  const { error } = await getSupabaseBrowser().from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error("Couldn't delete the conversation.");
}

/** The workspace's most recent conversations (same as the server's first load). */
export async function listRecentConversations(workspaceId: string, limit = 50): Promise<Conversation[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("conversations")
    .select("id, title, updated_at, claude_session_id, cost_cents, cap_cents, paused")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
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
