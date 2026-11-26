import "server-only";
import { canManage, type AppContext } from "@/lib/data/context";

/**
 * What the Ask screen needs for the getting-started checklist and the task ideas:
 * which tools the workspace has connected and which first steps are done.
 */
export type StartState = {
  connected: string[];
  hasMemory: boolean;
  hasDocuments: boolean;
  hasTasks: boolean;
  hasTeam: boolean;
  briefingOn: boolean;
  isManager: boolean;
};

export async function getStartState(ctx: AppContext): Promise<StartState> {
  const ws = ctx.workspace.id;
  const head = { count: "exact" as const, head: true };
  const [integrations, memory, documents, tasks, members, invites, briefing] = await Promise.all([
    ctx.supabase.from("integrations").select("provider").eq("workspace_id", ws).eq("status", "connected"),
    ctx.supabase.from("memory_entries").select("id", head).eq("workspace_id", ws),
    ctx.supabase.from("knowledge_documents").select("id", head).eq("workspace_id", ws),
    ctx.supabase.from("tasks").select("id", head).eq("workspace_id", ws),
    ctx.supabase.from("workspace_members").select("user_id", head).eq("workspace_id", ws),
    ctx.supabase.from("workspace_invites").select("id", head).eq("workspace_id", ws).eq("status", "pending"),
    ctx.supabase.from("daily_briefings").select("enabled").eq("user_id", ctx.user.id).eq("workspace_id", ws).maybeSingle(),
  ]);
  return {
    connected: [...new Set((integrations.data ?? []).map((i) => i.provider))],
    hasMemory: (memory.count ?? 0) > 0,
    hasDocuments: (documents.count ?? 0) > 0,
    hasTasks: (tasks.count ?? 0) > 0,
    hasTeam: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
    briefingOn: briefing.data?.enabled ?? false,
    isManager: canManage(ctx.workspace.role),
  };
}
