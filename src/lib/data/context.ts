import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { routes } from "@/config/routes";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { UserProfile, Workspace } from "@/types";
import type { Enums } from "@/types/database";
import { WORKSPACE_COOKIE } from "./workspace-cookie";

export type WorkspaceRole = Enums<"workspace_role">;

export type CurrentWorkspace = Workspace & {
  role: WorkspaceRole;
  taskCapUsd: number;
  monthlyLimitUsd: number;
};

export type AppContext = {
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>;
  user: UserProfile;
  workspace: CurrentWorkspace;
  /** Every workspace this user belongs to (for the switcher). */
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
};

const MEMBERSHIPS =
  "role, created_at, workspaces (id, name, slug, task_cap_usd, monthly_limit_usd)" as const;

/**
 * Who is signed in and which workspace they're working in. Cached for one request.
 * Returns null when nobody is signed in. All data access goes through this
 * user's Supabase client, so Row Level Security always applies.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const supabase = await getSupabaseServer();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const loadMemberships = () =>
    supabase.from("workspace_members").select(MEMBERSHIPS).eq("user_id", userId).order("created_at", { ascending: true });

  const [{ data: profile }, first] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, avatar_url").eq("id", userId).maybeSingle(),
    loadMemberships(),
  ]);
  let memberships = first.data ?? [];

  // Someone with no workspace (e.g. they deleted theirs) gets a fresh personal one
  if (profile && memberships.length === 0) {
    await supabase.rpc("ensure_workspace");
    memberships = (await loadMemberships()).data ?? [];
  }
  const usable = memberships.filter((m) => m.workspaces);
  if (!profile || usable.length === 0) return null;

  const chosenId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current = usable.find((m) => m.workspaces!.id === chosenId) ?? usable[0];
  const ws = current.workspaces!;

  return {
    supabase,
    user: {
      id: profile.id,
      fullName: profile.full_name || profile.email,
      email: profile.email,
      avatarUrl: profile.avatar_url ?? undefined,
    },
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role: current.role,
      taskCapUsd: Number(ws.task_cap_usd),
      monthlyLimitUsd: Number(ws.monthly_limit_usd),
    },
    workspaces: usable.map((m) => ({ id: m.workspaces!.id, name: m.workspaces!.name, role: m.role })),
  };
});

/** Like getAppContext, but sends people who aren't signed in to the sign-in page. */
export async function requireAppContext(): Promise<AppContext> {
  const context = await getAppContext();
  if (!context) redirect(routes.signIn);
  return context;
}

export function canManage(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}
