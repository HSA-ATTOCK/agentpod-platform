import "server-only";
import type { BetaManagedAgentsAgentCustomToolUseEvent } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import {
  approvalSummary,
  GOOGLE_TOOL_NAMES,
  NEEDS_APPROVAL,
  runGoogleTool,
  TOOL_LABELS,
} from "@/lib/integrations/google/tools";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { BabaStreamEvent } from "./protocol";
import { getClaude } from "./server";

/**
 * Runs the custom tools Baba asks for (Google so far) on our server.
 * Tools that change something outside Baba (send email, create event) are not run here:
 * they're saved as pending approvals, and /api/baba/confirm runs them once a person approves.
 */

export type CustomToolOutcome = "handled" | "awaiting_approval";
export type CustomToolHandler = (
  event: BetaManagedAgentsAgentCustomToolUseEvent,
  sessionId: string,
  emit: (event: BabaStreamEvent) => void,
) => Promise<CustomToolOutcome>;

async function sendResult(sessionId: string, toolUseId: string, text: string, isError: boolean) {
  await getClaude().beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: toolUseId,
        is_error: isError,
        content: [{ type: "text", text }],
      },
    ],
  });
}

// Tool calls already being handled by this server (a reconnect mustn't run one twice)
const inFlight = (globalThis as unknown as { __babaToolCalls?: Set<string> }).__babaToolCalls ??= new Set<string>();
(globalThis as unknown as { __babaToolCalls?: Set<string> }).__babaToolCalls = inFlight;

export function createCustomToolHandler(scope: { workspaceId: string; conversationId: string }): CustomToolHandler {
  return async (event, sessionId, emit) => {
    if (!NEEDS_APPROVAL.has(event.name)) {
      if (inFlight.has(event.id)) return "handled";
      inFlight.add(event.id);
      setTimeout(() => inFlight.delete(event.id), 10 * 60_000);
    }
    const label = TOOL_LABELS[event.name] ?? event.name;
    const stepId = `custom-${event.id}`;

    if (!GOOGLE_TOOL_NAMES.has(event.name)) {
      await sendResult(sessionId, event.id, `Unknown tool "${event.name}".`, true);
      return "handled";
    }
    if (!isAdminConfigured()) {
      await sendResult(sessionId, event.id, "Connected tools aren't set up on this server (SUPABASE_SECRET_KEY is missing).", true);
      return "handled";
    }

    if (NEEDS_APPROVAL.has(event.name)) {
      const admin = getSupabaseAdmin();
      await admin.from("tool_approvals").upsert(
        {
          workspace_id: scope.workspaceId,
          conversation_id: scope.conversationId,
          tool_use_id: event.id,
          tool_name: event.name,
          input: event.input as Json,
        },
        { onConflict: "tool_use_id", ignoreDuplicates: true },
      );
      // Show it as waiting in Activity
      await admin
        .from("tasks")
        .update({ status: "needs_approval" })
        .eq("conversation_id", scope.conversationId)
        .eq("status", "running");
      emit({ type: "step", id: stepId, label: `Waiting for your approval: ${label.toLowerCase()}`, status: "running" });
      emit({ type: "approval", toolUseId: event.id, toolName: label, summary: approvalSummary(event.name, event.input) });
      return "awaiting_approval";
    }

    emit({ type: "step", id: stepId, label, status: "running" });
    const result = await runGoogleTool(event.name, event.input, { workspaceId: scope.workspaceId, sessionId });
    await sendResult(sessionId, event.id, result.text, result.isError);
    emit({
      type: "step",
      id: stepId,
      label,
      status: result.isError ? "failed" : "done",
      detail: result.isError ? result.text.slice(0, 200) : undefined,
    });
    return "handled";
  };
}

/**
 * A person approved or rejected a pending tool call: run it (or tell Baba it was declined).
 * Returns null if `toolUseId` isn't a pending custom-tool approval for this conversation.
 */
export async function decidePendingTool(input: {
  workspaceId: string;
  conversationId: string;
  sessionId: string;
  toolUseId: string;
  allow: boolean;
  userId: string;
}) {
  if (!isAdminConfigured()) return null;
  const admin = getSupabaseAdmin();
  // Claim it (only one decision counts, even with two clicks)
  const { data: claimed } = await admin
    .from("tool_approvals")
    .update({ status: input.allow ? "approved" : "rejected", decided_by: input.userId, decided_at: new Date().toISOString() })
    .eq("tool_use_id", input.toolUseId)
    .eq("conversation_id", input.conversationId)
    .eq("workspace_id", input.workspaceId)
    .eq("status", "pending")
    .select("tool_name, input")
    .maybeSingle();
  if (!claimed) {
    const { data: existing } = await admin.from("tool_approvals").select("status").eq("tool_use_id", input.toolUseId).maybeSingle();
    return existing ? { ok: false as const, message: "This was already decided." } : null;
  }

  await admin.from("tasks").update({ status: "running" }).eq("conversation_id", input.conversationId).eq("status", "needs_approval");

  if (!input.allow) {
    await sendResult(input.sessionId, input.toolUseId, "The user declined this action. Don't retry it unless they ask.", true);
    return { ok: true as const, message: "Declined." };
  }
  const result = await runGoogleTool(claimed.tool_name, claimed.input as Record<string, unknown>, {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
  });
  if (result.isError) await admin.from("tool_approvals").update({ status: "failed" }).eq("tool_use_id", input.toolUseId);
  await sendResult(input.sessionId, input.toolUseId, result.text, result.isError);
  return { ok: !result.isError, message: result.text };
}
