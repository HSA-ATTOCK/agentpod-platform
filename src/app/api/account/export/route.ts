import { getAppContext } from "@/lib/data/context";
import { audit } from "@/lib/platform/account";

/**
 * GET /api/account/export — downloads your data as JSON (PRD §18.3, GDPR-style export):
 * your profile, and everything you can see in the current workspace. Secrets (keys, tokens,
 * database passwords, webhook tokens) are never included. Owners/admins get the full workspace.
 */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const ws = ctx.workspace.id;
  const db = ctx.supabase;
  const [profile, workspace, members, conversations, items, tasks, workflows, files, memory, documents, chunks, sites, integrations, prefs] = await Promise.all([
    db.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle(),
    db.from("workspaces").select("id, name, slug, industry, company_size, timezone, task_cap_usd, monthly_limit_usd, business_context, created_at").eq("id", ws).maybeSingle(),
    db.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", ws),
    db.from("conversations").select("id, title, cost_cents, created_by, created_at, updated_at").eq("workspace_id", ws),
    db.from("conversation_items").select("conversation_id, type, data, created_at").eq("workspace_id", ws).order("position").limit(50000),
    db.from("tasks").select("id, conversation_id, workflow_id, request, status, cost_cents, agents, error, started_at, finished_at").eq("workspace_id", ws),
    db.from("workflows").select("id, name, instruction, frequency, day_of_week, time_of_day, cap_usd, enabled, created_at").eq("workspace_id", ws),
    db.from("files").select("id, name, kind, size_bytes, conversation_id, created_at").eq("workspace_id", ws),
    db.from("memory_entries").select("category, content, source, created_at").eq("workspace_id", ws),
    db.from("knowledge_documents").select("id, title, file_name, created_at").eq("workspace_id", ws),
    db.from("knowledge_chunks").select("document_id, position, content").eq("workspace_id", ws).order("position").limit(50000),
    db.from("sites").select("id, name, status, current_version, created_at").eq("workspace_id", ws),
    db.from("integrations").select("provider, label, account_email, status, created_at").eq("workspace_id", ws),
    db.from("notification_preferences").select("prefs").eq("user_id", ctx.user.id).eq("workspace_id", ws).maybeSingle(),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    note: "Your Baba data. Secrets such as API keys, tokens and passwords are never exported. Generated files can be downloaded from Projects.",
    profile: profile.data,
    workspace: workspace.data,
    your_role: ctx.workspace.role,
    members: members.data,
    conversations: (conversations.data ?? []).map((c) => ({ ...c, messages: (items.data ?? []).filter((i) => i.conversation_id === c.id).map(({ type, data, created_at }) => ({ type, data, created_at })) })),
    tasks: tasks.data,
    workflows: workflows.data,
    files: files.data,
    memory: memory.data,
    knowledge: (documents.data ?? []).map((d) => ({ ...d, text: (chunks.data ?? []).filter((c) => c.document_id === d.id).map((c) => c.content).join("\n\n") })),
    websites: sites.data,
    connections: integrations.data,
    notification_preferences: prefs.data?.prefs ?? null,
  };
  await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ws, action: "account.data_exported", targetType: "workspace", targetId: ws });
  const name = `baba-export-${(workspace.data?.slug ?? "workspace").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
