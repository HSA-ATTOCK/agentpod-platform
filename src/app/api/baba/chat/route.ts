import {
  babaGate,
  conversationCapCents,
  loadConversation,
  monthlyLimitReached,
  notFound,
  trackTurn,
  withBusinessContext,
} from "@/lib/baba/conversations";
import type { BabaChatRequest } from "@/lib/baba/protocol";
import { babaConfig, getClaude } from "@/lib/baba/server";
import { streamTurn } from "@/lib/baba/stream-turn";
import { MAX_ATTACHMENTS, safeFileName, verifyUpload } from "@/lib/baba/uploads";
import { appOrigin } from "@/lib/email/mailer";

// Long tasks stream for a while. (Vercel caps this by plan.)
export const maxDuration = 300;

/**
 * POST /api/baba/chat — body: { conversationId, text }
 * Sends the user's message to Baba and streams progress back as newline-delimited JSON.
 * Creates the conversation's Claude session (with its spending cap) on the first message.
 */
export async function POST(request: Request) {
  const gate = await babaGate({ write: true });
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  let body: BabaChatRequest;
  try {
    body = (await request.json()) as BabaChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (rawAttachments.length > MAX_ATTACHMENTS) {
    return Response.json({ error: `You can attach up to ${MAX_ATTACHMENTS} files at a time.` }, { status: 400 });
  }
  // Only files this workspace uploaded (checked with the signed token from /api/baba/uploads)
  const attachments = rawAttachments.filter(
    (a) =>
      a &&
      typeof a.fileId === "string" &&
      typeof a.token === "string" &&
      typeof a.name === "string" &&
      verifyUpload(a.fileId, ctx.workspace.id, a.token),
  );
  if (attachments.length !== rawAttachments.length) {
    return Response.json({ error: "One of the attached files couldn't be verified. Please attach it again." }, { status: 400 });
  }

  const text =
    (typeof body.text === "string" ? body.text.trim() : "") ||
    (attachments.length > 0 ? "Please look at the attached file(s) and tell me what's in them." : "");
  if (!text) return Response.json({ error: "Message is empty." }, { status: 400 });
  if (text.length > 20_000) return Response.json({ error: "Message is too long." }, { status: 413 });

  const conversation = await loadConversation(ctx, body.conversationId);
  if (!conversation) return notFound();
  if (conversation.paused) {
    return Response.json(
      { error: "This conversation is paused at its spending cap. Click Continue to finish the task first." },
      { status: 409 },
    );
  }

  const overLimit = await monthlyLimitReached(ctx);
  if (overLimit) return overLimit;
  let capCents = conversationCapCents(ctx);

  // "Run now" on a workflow: link the task to it (only if this workspace can see it)
  let workflowId: string | null = null;
  if (typeof body.workflowId === "string" && /^[0-9a-f-]{36}$/i.test(body.workflowId)) {
    const { data: workflow } = await ctx.supabase
      .from("workflows")
      .select("id, cap_usd")
      .eq("id", body.workflowId)
      .eq("workspace_id", conversation.workspace_id)
      .maybeSingle();
    workflowId = workflow?.id ?? null;
    // A new conversation started by a workflow uses the workflow's own cap
    if (workflow && !conversation.claude_session_id) capCents = Math.max(1, Math.round(Number(workflow.cap_usd) * 100));
  }

  // One row per request, for the Activity page
  const { data: task, error: taskError } = await ctx.supabase
    .from("tasks")
    .insert({
      workspace_id: conversation.workspace_id,
      conversation_id: conversation.id,
      created_by: ctx.user.id,
      workflow_id: workflowId,
      request: text.slice(0, 2000),
      cap_cents: capCents,
    })
    .select("id")
    .single();
  if (taskError) {
    console.error("[baba/chat] task", taskError.message);
    return Response.json({ error: "Couldn't save this task. Please try again." }, { status: 500 });
  }

  const claude = getClaude();
  const { agentId, environmentId } = babaConfig();
  let isFirstMessage = false;

  return streamTurn({
    request,
    logName: "baba/chat",
    track: trackTurn(ctx, conversation, task.id, appOrigin(request)),
    async prepare(emit) {
      // One Claude session per conversation, with a spending cap
      let sessionId = conversation.claude_session_id;
      if (!sessionId) {
        isFirstMessage = true;
        const session = await claude.beta.sessions.create({
          agent: agentId!,
          environment_id: environmentId!,
          title: text.slice(0, 80),
          budget: { type: "limit", max_list_cost: { amount: String(capCents), currency: "USD" } },
          metadata: { workspace_id: conversation.workspace_id, conversation_id: conversation.id },
        });
        sessionId = session.id;
        const { error } = await ctx.supabase
          .from("conversations")
          .update({ claude_session_id: sessionId, cap_cents: capCents })
          .eq("id", conversation.id);
        if (error) throw new Error(`Couldn't link the conversation: ${error.message}`);
      }
      emit({ type: "session", sessionId });
      return sessionId;
    },
    async kickoff(sessionId) {
      // The first message of a conversation carries the workspace's "About your business" notes
      let message = isFirstMessage ? await withBusinessContext(ctx.supabase, conversation.workspace_id, text) : text;
      // Attached files: mounted in the agents' workspace (for code and the specialists),
      // and images/PDFs also shown to Baba directly
      type Block = { type: "text"; text: string } | { type: "image" | "document"; source: { type: "file"; file_id: string } };
      const blocks: Block[] = [];
      if (attachments.length > 0) {
        const paths: string[] = [];
        for (const file of attachments) {
          const path = `/mnt/session/uploads/${file.fileId.slice(-8)}-${safeFileName(file.name)}`;
          await claude.beta.sessions.resources.add(sessionId, { type: "file", file_id: file.fileId, mount_path: path });
          paths.push(`- ${file.name}: ${path}`);
          if (file.mimeType.startsWith("image/")) blocks.push({ type: "image", source: { type: "file", file_id: file.fileId } });
          else if (file.mimeType === "application/pdf") blocks.push({ type: "document", source: { type: "file", file_id: file.fileId } });
        }
        message += `\n\n[Files I attached, available in your workspace (read-only; copy before editing):\n${paths.join("\n")}]`;
      }
      await claude.beta.sessions.events.send(sessionId, {
        events: [{ type: "user.message", content: [...blocks, { type: "text", text: message }] }],
      });
    },
  });
}
