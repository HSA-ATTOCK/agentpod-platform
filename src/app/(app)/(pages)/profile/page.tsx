import type { Metadata } from "next";
import { ProfileView, type ProfileUsage } from "@/components/pages/profile-view";
import { requireAppContext } from "@/lib/data/context";
import { getProfile, monthStart } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Profile" };

async function PageContent() {
  const ctx = await requireAppContext();
  const [profile, { data: myTasks }, { data: hasPassword }] = await Promise.all([
    getProfile(ctx),
    ctx.supabase
      .from("tasks")
      .select("cost_cents, agents")
      .eq("workspace_id", ctx.workspace.id)
      .eq("created_by", ctx.user.id)
      .gte("started_at", monthStart()),
    // Google-only accounts have no password, so there's nothing to change
    ctx.supabase.rpc("my_account_has_password"),
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

  return <ProfileView profile={profile} role={ctx.workspace.role} usage={usage} hasPassword={hasPassword === true} />;
}

/** Shows a placeholder straight away while this page's data loads. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
