import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { routes } from "@/config/routes";
import { getAccount, getPlatformSettings } from "@/lib/platform/account";
import { platformLimits, stricter, type PlatformLimits } from "@/lib/platform/limits";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { UserProfile, Workspace } from "@/types";
import type { Enums } from "@/types/database";
import { WORKSPACE_COOKIE } from "./workspace-cookie";

export type WorkspaceRole = Enums<"workspace_role">;

export type CurrentWorkspace = Workspace & {
  role: WorkspaceRole;
  taskCapUsd: number;
  monthlyLimitUsd: number;
  logoUrl: string | null;
  /** Set by the platform administrator (plan / overrides); null = no daily limit. */
  dailyLimitUsd: number | null;
  limits: PlatformLimits;
};

export type AppContext = {
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>;
  user: UserProfile;
  workspace: CurrentWorkspace;
  /** Every workspace this user belongs to (for the switcher). */
  workspaces: { id: string; name: string; role: WorkspaceRole }[];
  /** A platform (master) administrator — separate from workspace roles. */
  isPlatformAdmin: boolean;
};

const MEMBERSHIPS =
  "role, created_at, workspaces (id, name, slug, task_cap_usd, monthly_limit_usd, logo_url)" as const;

/**
 * Who is signed in and which workspace they're working in. Cached for one request.
 * Returns null when nobody is signed in. All data access goes through this
 * user's Supabase client, so Row Level Security always applies.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  // Signed-in data is per request (and checking the session reads the clock), so never prerender it
  await connection();
  const supabase = await getSupabaseServer();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;
  // If two-step verification is on but wasn't done in this session, the database (RLS)
  // returns no profile below, so this returns null and requireAppContext asks for the code.
  // Accounts that aren't approved get nothing from the database either (see platform_admin migration).
  const account = await getAccount(supabase);
  if (!account || account.status !== "approved") return null;

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
  // The platform admin's plan and limits; the stricter of theirs and the workspace's own settings applies
  const limits = await platformLimits(supabase, ws.id);

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
      taskCapUsd: stricter(Number(ws.task_cap_usd), limits.taskCapUsd),
      monthlyLimitUsd: stricter(Number(ws.monthly_limit_usd), limits.monthlyLimitUsd),
      logoUrl: ws.logo_url,
      dailyLimitUsd: limits.dailyLimitUsd,
      limits,
    },
    workspaces: usable.map((m) => ({ id: m.workspaces!.id, name: m.workspaces!.name, role: m.role })),
    isPlatformAdmin: account.isAdmin,
  };
});

/** True when the user has two-step verification on but hasn't entered a code this session. */
export async function mfaPending(supabase: Awaited<ReturnType<typeof getSupabaseServer>>) {
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub || claims.claims.aal === "aal2") return false;
  // Asks Supabase Auth (verified) rather than trusting the cookie
  const { data } = await supabase.auth.mfa.listFactors();
  return Boolean(data?.totp.some((factor) => factor.status === "verified"));
}

/**
 * Like getAppContext, but sends people who aren't signed in to the sign-in page
 * (or to the two-step code page if that's what's missing).
 */
export async function requireAppContext(): Promise<AppContext> {
  const context = await getAppContext();
  if (!context) {
    const supabase = await getSupabaseServer();
    const account = await getAccount(supabase);
    // Signed in but not approved (waiting, rejected, suspended): the status screen
    if (account && account.status !== "approved") redirect(routes.pending);
    if (await mfaPending(supabase)) redirect(routes.twoFactor);
    redirect(routes.signIn);
  }
  // Maintenance mode lets only platform administrators in
  if (!context.isPlatformAdmin && (await getPlatformSettings(context.supabase))?.maintenanceMode) redirect(routes.pending);
  return context;
}

export function canManage(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}
