import "server-only";
import type { BetaManagedAgentsAgentCustomToolUseEvent } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import {
  apiRequest,
  apiRequestSummary,
  cleanHost,
  CONNECTION_TOOL_NAMES,
  connectionNeedsApproval,
  listConnectionsText,
} from "@/lib/integrations/connections";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import {
  approvalSummary as googleApprovalSummary,
  GOOGLE_TOOL_NAMES,
  NEEDS_APPROVAL as GOOGLE_NEEDS_APPROVAL,
  runGoogleTool,
  TOOL_LABELS as GOOGLE_LABELS,
} from "@/lib/integrations/google/tools";
import { APP_LABELS, APP_TOOL_NAMES, appApprovalSummary, appToolNeedsApproval, runAppTool } from "@/lib/app-tools/tools";
import type { AppContext } from "@/lib/data/context";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { BabaStreamEvent } from "./protocol";
import { getClaude } from "./server";

/**
 * Runs the custom tools Baba asks for, on our server:
 * - Google tools (Gmail, Drive, Calendar) with the workspace's tokens
 * - connection tools: list what's connected, show a Connect button or a secure key box
 *   in the chat, and call services added with an API key
 * Calls that change something outside Baba are saved as pending approvals instead, and
 * /api/baba/confirm runs them once a person approves.
 */

export type CustomToolOutcome = "handled" | "awaiting_approval";
export type CustomToolHandler = (
  event: BetaManagedAgentsAgentCustomToolUseEvent,
  sessionId: string,
  emit: (event: BabaStreamEvent) => void,
) => Promise<CustomToolOutcome>;

type Input = Record<string, unknown>;
const str = (input: Input, key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

function needsApproval(name: string, input: Input) {
  return GOOGLE_NEEDS_APPROVAL.has(name) || connectionNeedsApproval(name, input) || appToolNeedsApproval(name);
}

function label(name: string, input: Input) {
  switch (name) {
    case "list_connections":
      return "Checking connected tools";
    case "request_connection":
      return "Asking you to connect Google";
    case "request_api_key":
      return `Asking for a ${str(input, "service_name") || "service"} API key`;
    case "api_request":
      return `Calling ${str(input, "service_name") || "a connected service"}`;
    default:
      return APP_LABELS[name] ?? GOOGLE_LABELS[name] ?? name;
  }
}

function summary(name: string, input: Input) {
  if (name === "api_request") return apiRequestSummary(input);
  if (APP_TOOL_NAMES.has(name)) return appApprovalSummary(name, input);
  return googleApprovalSummary(name, input);
}

/** Runs a tool that doesn't need the chat UI, as the person in `ctx`. */
async function runTool(name: string, input: Input, scope: { workspaceId: string; sessionId: string; ctx: AppContext }) {
  if (APP_TOOL_NAMES.has(name)) return runAppTool(name, input, scope.ctx);
  if (GOOGLE_TOOL_NAMES.has(name)) return runGoogleTool(name, input, scope);
  if (name === "list_connections") return { text: await listConnectionsText(scope.workspaceId), isError: false };
  if (name === "api_request") return apiRequest(scope.workspaceId, input);
  return { text: `Unknown tool "${name}".`, isError: true };
}

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
const store = globalThis as unknown as { __babaToolCalls?: Set<string> };
const inFlight = (store.__babaToolCalls ??= new Set<string>());

export function createCustomToolHandler(scope: { workspaceId: string; conversationId: string; ctx: AppContext }): CustomToolHandler {
  return async (event, sessionId, emit) => {
    const input = (event.input ?? {}) as Input;
    const approval = needsApproval(event.name, input);
    if (!approval) {
      if (inFlight.has(event.id)) return "handled";
      inFlight.add(event.id);
      setTimeout(() => inFlight.delete(event.id), 10 * 60_000);
    }
    const stepLabel = label(event.name, input);
    const stepId = `custom-${event.id}`;

    if (!GOOGLE_TOOL_NAMES.has(event.name) && !CONNECTION_TOOL_NAMES.has(event.name) && !APP_TOOL_NAMES.has(event.name)) {
      await sendResult(sessionId, event.id, `Unknown tool "${event.name}".`, true);
      return "handled";
    }
    if (!isAdminConfigured() && !APP_TOOL_NAMES.has(event.name)) {
      await sendResult(sessionId, event.id, "Connected tools aren't set up on this server yet (the server's SUPABASE_SECRET_KEY is missing). This is a one-time setup by the platform owner.", true);
      return "handled";
    }

    // ---- Things shown in the chat for the user to do ----
    if (event.name === "request_connection") {
      if (str(input, "service") !== "google") {
        await sendResult(sessionId, event.id, "Only \"google\" can be connected with a button so far.", true);
        return "handled";
      }
      if (!isGoogleConfigured()) {
        await sendResult(sessionId, event.id, "Google sign-in hasn't been set up on this Baba server yet. This is a one-time setup by whoever runs this Baba (the platform owner adds Google's client ID and secret; see the README section \"One-time platform setup\"). Tell the user exactly that; do NOT say Gmail is 'coming soon'. Customers never need to do this themselves.", true);
        return "handled";
      }
      emit({ type: "connect_request", id: event.id, service: "google", reason: str(input, "reason") });
      await sendResult(
        sessionId,
        event.id,
        "A 'Connect Google' button is now shown in the chat. Stop here: ask the user to click it, sign in, and tell you when it's done. Then check with list_connections.",
        false,
      );
      emit({ type: "step", id: stepId, label: stepLabel, status: "done" });
      return "handled";
    }

    if (event.name === "request_api_key") {
      const host = cleanHost(str(input, "api_host"));
      if (!host || !str(input, "service_name")) {
        await sendResult(sessionId, event.id, "Give service_name and a valid public api_host (e.g. api.example.com).", true);
        return "handled";
      }
      emit({
        type: "key_request",
        id: event.id,
        serviceName: str(input, "service_name").slice(0, 60),
        apiHost: host,
        headerName: str(input, "header_name") || "Authorization",
        headerPrefix: typeof input.header_prefix === "string" ? (input.header_prefix as string) : "Bearer ",
        queryParam: str(input, "query_param") || null,
        instructions: str(input, "instructions").slice(0, 3000),
      });
      await sendResult(
        sessionId,
        event.id,
        "A secure box for the key is now shown in the chat. Stop here: ask the user to paste the key into that box (not into the chat) and tell you when it's saved. Then check with list_connections.",
        false,
      );
      emit({ type: "step", id: stepId, label: stepLabel, status: "done" });
      return "handled";
    }

    // ---- Changes outside Baba: wait for a person's OK ----
    if (approval && !isAdminConfigured()) {
      await sendResult(sessionId, event.id, "Changes that need approval can't be made on this server yet (SUPABASE_SECRET_KEY is missing). This is a one-time setup by the platform owner.", true);
      return "handled";
    }
    if (approval) {
      const admin = getSupabaseAdmin();
      await admin.from("tool_approvals").upsert(
        {
          workspace_id: scope.workspaceId,
          conversation_id: scope.conversationId,
          tool_use_id: event.id,
          tool_name: event.name,
          input: input as Json,
        },
        { onConflict: "tool_use_id", ignoreDuplicates: true },
      );
      // Show it as waiting in Activity
      await admin
        .from("tasks")
        .update({ status: "needs_approval" })
        .eq("conversation_id", scope.conversationId)
        .eq("status", "running");
      emit({ type: "step", id: stepId, label: `Waiting for your approval: ${stepLabel.toLowerCase()}`, status: "running" });
      emit({ type: "approval", toolUseId: event.id, toolName: stepLabel, summary: summary(event.name, input) });
      return "awaiting_approval";
    }

    // ---- Everything else runs straight away ----
    emit({ type: "step", id: stepId, label: stepLabel, status: "running" });
    const result = await runTool(event.name, input, { workspaceId: scope.workspaceId, sessionId, ctx: scope.ctx });
    await sendResult(sessionId, event.id, result.text, result.isError);
    emit({
      type: "step",
      id: stepId,
      label: stepLabel,
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
  /** The person deciding: the action runs with their permissions. */
  ctx: AppContext;
}) {
  if (!isAdminConfigured()) return null;
  const admin = getSupabaseAdmin();
  // Claim it (only one decision counts, even with two clicks)
  const { data: claimed } = await admin
    .from("tool_approvals")
    .update({ status: input.allow ? "approved" : "rejected", decided_by: input.ctx.user.id, decided_at: new Date().toISOString() })
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
  const result = await runTool(claimed.tool_name, claimed.input as Input, {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    ctx: input.ctx,
  });
  if (result.isError) await admin.from("tool_approvals").update({ status: "failed" }).eq("tool_use_id", input.toolUseId);
  await sendResult(input.sessionId, input.toolUseId, result.text, result.isError);
  return { ok: !result.isError, message: result.text };
}
