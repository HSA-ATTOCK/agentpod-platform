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
import { googleClientFor } from "@/lib/integrations/google/oauth";
import {
  approvalSummary as googleApprovalSummary,
  GOOGLE_TOOL_NAMES,
  NEEDS_APPROVAL as GOOGLE_NEEDS_APPROVAL,
  runGoogleTool,
  TOOL_LABELS as GOOGLE_LABELS,
} from "@/lib/integrations/google/tools";
import { APP_LABELS, APP_TOOL_NAMES, appApprovalSummary, appToolNeedsApproval, runAppTool } from "@/lib/app-tools/tools";
import { audit } from "@/lib/platform/account";
import { NATIVE_LABELS, NATIVE_NEEDS_APPROVAL, NATIVE_TOOL_NAMES, nativeApprovalSummary, runNativeTool } from "@/lib/integrations/native-tools";
import { isOAuthProvider, oauthClientFor, PROVIDERS } from "@/lib/integrations/oauth-apps";
import {
  runWorkspaceTool,
  WORKSPACE_LABELS,
  WORKSPACE_NEEDS_APPROVAL,
  WORKSPACE_TOOL_NAMES,
  workspaceApprovalSummary,
} from "@/lib/workspace-tools/tools";
import type { AppContext } from "@/lib/data/context";
import { serverOrigin } from "@/lib/origin";
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
  return GOOGLE_NEEDS_APPROVAL.has(name) || connectionNeedsApproval(name, input) || appToolNeedsApproval(name) || WORKSPACE_NEEDS_APPROVAL.has(name) || NATIVE_NEEDS_APPROVAL.has(name);
}

function label(name: string, input: Input) {
  switch (name) {
    case "list_connections":
      return "Checking connected tools";
    case "request_connection":
      return `Asking you to connect ${isOAuthProvider(str(input, "service")) ? PROVIDERS[str(input, "service") as keyof typeof PROVIDERS].name : "Google"}`;
    case "request_api_key":
      return `Asking for a ${str(input, "service_name") || "service"} API key`;
    case "api_request":
      return `Calling ${str(input, "service_name") || "a connected service"}`;
    case "run_custom_agent":
      return `${str(input, "agent") || "Your custom agent"} is working on a sub-task`;
    default:
      return NATIVE_LABELS[name] ?? WORKSPACE_LABELS[name] ?? APP_LABELS[name] ?? GOOGLE_LABELS[name] ?? name;
  }
}

function summary(name: string, input: Input) {
  if (name === "api_request") return apiRequestSummary(input);
  if (APP_TOOL_NAMES.has(name)) return appApprovalSummary(name, input);
  if (WORKSPACE_TOOL_NAMES.has(name)) return workspaceApprovalSummary(name, input);
  if (NATIVE_TOOL_NAMES.has(name)) return nativeApprovalSummary(name, input);
  return googleApprovalSummary(name, input);
}

/** Runs a tool that doesn't need the chat UI, as the person in `ctx`. */
async function runTool(name: string, input: Input, scope: { workspaceId: string; sessionId: string; conversationId: string; ctx: AppContext }) {
  const result = await runToolInner(name, input, scope);
  // Every tool Baba runs on our server is recorded (inputs aren't stored: they can contain business data)
  await audit({
    actorId: scope.ctx.user.id,
    actorEmail: scope.ctx.user.email,
    workspaceId: scope.workspaceId,
    action: `tool.${name}`,
    targetType: "conversation",
    targetId: scope.conversationId,
    details: { ok: !result.isError },
  });
  return result;
}

async function runToolInner(name: string, input: Input, scope: { workspaceId: string; sessionId: string; conversationId: string; ctx: AppContext }) {
  if (NATIVE_TOOL_NAMES.has(name)) return runNativeTool(name, input, { workspaceId: scope.workspaceId });
  if (WORKSPACE_TOOL_NAMES.has(name)) return runWorkspaceTool(name, input, { ctx: scope.ctx, sessionId: scope.sessionId, conversationId: scope.conversationId });
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

    if (!GOOGLE_TOOL_NAMES.has(event.name) && !CONNECTION_TOOL_NAMES.has(event.name) && !APP_TOOL_NAMES.has(event.name) && !WORKSPACE_TOOL_NAMES.has(event.name) && !NATIVE_TOOL_NAMES.has(event.name)) {
      await sendResult(sessionId, event.id, `Unknown tool "${event.name}".`, true);
      return "handled";
    }
    if (!isAdminConfigured() && !APP_TOOL_NAMES.has(event.name)) {
      await sendResult(sessionId, event.id, "Connected tools aren't set up on this server yet (the server's SUPABASE_SECRET_KEY is missing). This is a one-time setup by the platform owner.", true);
      return "handled";
    }

    // ---- Things shown in the chat for the user to do ----
    if (event.name === "request_connection" && isOAuthProvider(str(input, "service"))) {
      const service = str(input, "service") as keyof typeof PROVIDERS;
      const cfg = PROVIDERS[service];
      const isManager = scope.ctx.workspace.role === "owner" || scope.ctx.workspace.role === "admin";
      if (!isManager) {
        await sendResult(sessionId, event.id, `Only a workspace owner or admin can connect ${cfg.name}. Tell the user to ask one of them.`, true);
        return "handled";
      }
      if (!(await oauthClientFor(scope.workspaceId, service))) {
        emit({
          type: "oauth_app_request",
          id: event.id,
          service,
          serviceName: cfg.name,
          redirectUri: `${serverOrigin()}/api/integrations/oauth/${service}/callback`,
          consoleUrl: cfg.setup.consoleUrl,
          steps: cfg.setup.steps,
          reason: str(input, "reason"),
        });
        await sendResult(
          sessionId,
          event.id,
          `This workspace hasn't set up its ${cfg.name} app yet, so a secure one-time setup card is shown in the chat with step-by-step instructions and boxes for the Client ID and secret (never paste them in the chat). Once saved it becomes a Connect button. Briefly tell the user that, offer help with any step, then stop and wait.`,
          false,
        );
      } else {
        emit({ type: "connect_request", id: event.id, service, reason: str(input, "reason") });
        await sendResult(sessionId, event.id, `A 'Connect ${cfg.name}' button is now shown in the chat. Stop and ask the user to click it and tell you when it's done. Then check with list_connections.`, false);
      }
      emit({ type: "step", id: stepId, label: stepLabel, status: "done" });
      return "handled";
    }

    if (event.name === "request_connection") {
      if (str(input, "service") !== "google") {
        await sendResult(sessionId, event.id, "Supported services: google, slack, hubspot, microsoft, quickbooks, xero, shopify.", true);
        return "handled";
      }
      if (!(await googleClientFor(scope.workspaceId))) {
        const isManager = scope.ctx.workspace.role === "owner" || scope.ctx.workspace.role === "admin";
        if (!isManager) {
          await sendResult(sessionId, event.id, "This workspace hasn't set up Google yet, and only an owner or admin can do it. Tell the user to ask one of them to say \"connect my Gmail\" to Baba.", true);
          return "handled";
        }
        // No Google app for this workspace yet: show the secure setup card (Client ID + secret, then Connect)
        emit({
          type: "google_app_request",
          id: event.id,
          redirectUri: `${serverOrigin()}/api/integrations/google/callback`,
          reason: str(input, "reason"),
        });
        await sendResult(
          sessionId,
          event.id,
          "This workspace doesn't have its Google app yet, so a secure setup card is now shown in the chat. It has the step-by-step " +
            "instructions (create a Google Cloud project, enable the Gmail/Drive/Calendar APIs, set up the consent screen with the user as a " +
            "test user, create an OAuth client ID with the redirect address shown on the card) and two boxes for the Client ID and secret. " +
            "Briefly say this is a one-time setup of about 10 minutes, that the ID and secret go ONLY in the card (never in the chat), and " +
            "that once saved the card turns into a Connect Google button. Offer to explain any step. Then stop and wait.",
          false,
        );
        emit({ type: "step", id: stepId, label: "Setting up Google for this workspace", status: "done" });
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

    if (event.name === "request_database_connection") {
      emit({ type: "db_request", id: event.id, engine: str(input, "engine") === "mysql" ? "mysql" : "postgres", reason: str(input, "reason").slice(0, 300) });
      await sendResult(
        sessionId,
        event.id,
        "A secure database form is now shown in the chat. Stop here: ask the user to fill it in (host, database, a read-only user and password — never in the chat) and tell you when it's connected. Then use db_query.",
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
    const result = await runTool(event.name, input, { workspaceId: scope.workspaceId, sessionId, conversationId: scope.conversationId, ctx: scope.ctx });
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
    conversationId: input.conversationId,
    ctx: input.ctx,
  });
  if (result.isError) await admin.from("tool_approvals").update({ status: "failed" }).eq("tool_use_id", input.toolUseId);
  await sendResult(input.sessionId, input.toolUseId, result.text, result.isError);
  return { ok: !result.isError, message: result.text };
}
