import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { routes } from "@/config/routes";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { UserProfile, Workspace } from "@/types";
import type { Enums } from "@/types/database";

export type WorkspaceRole = Enums<"workspace_role">;

export type AppContext = {
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>;
  user: UserProfile;
  workspace: Workspace & { role: WorkspaceRole };
};

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

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, avatar_url").eq("id", userId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, workspaces (id, name, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const ws = membership?.workspaces;
  if (!profile || !membership || !ws) return null;

  return {
    supabase,
    user: {
      id: profile.id,
      fullName: profile.full_name || profile.email,
      email: profile.email,
      avatarUrl: profile.avatar_url ?? undefined,
    },
    workspace: { id: ws.id, name: ws.name, slug: ws.slug, role: membership.role },
  };
});

/** Like getAppContext, but sends people who aren't signed in to the sign-in page. */
export async function requireAppContext(): Promise<AppContext> {
  const context = await getAppContext();
  if (!context) redirect(routes.signIn);
  return context;
}
