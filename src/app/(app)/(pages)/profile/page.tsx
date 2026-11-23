import type { Metadata } from "next";
import { ProfileView, type ProfileUsage } from "@/components/pages/profile-view";
import { requireAppContext } from "@/lib/data/context";
import { getProfile, monthStart } from "@/lib/data/pages";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const ctx = await requireAppContext();
  const [profile, { data: myTasks }] = await Promise.all([
    getProfile(ctx),
    ctx.supabase
      .from("tasks")
      .select("cost_cents, agents")
      .eq("workspace_id", ctx.workspace.id)
      .eq("created_by", ctx.user.id)
      .gte("started_at", monthStart()),
  ]);

  const counts = new Map<string, number>();
  for (const task of myTasks ?? []) {
    for (const agent of task.agents) if (agent !== "Baba") counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }
  const usage: ProfileUsage = {
    tasks: myTasks?.length ?? 0,
    costCents: (myTasks ?? []).reduce((sum, t) => sum + t.cost_cents, 0),
    topSpecialist: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };

  return <ProfileView profile={profile} role={ctx.workspace.role} usage={usage} />;
}
