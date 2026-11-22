"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import type { ChatItem } from "@/types/chat";

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
