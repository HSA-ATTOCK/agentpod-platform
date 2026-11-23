import type { Metadata } from "next";
import { SettingsView } from "@/components/pages/settings-view";
import type { NotificationPrefs } from "@/config/notifications";
import { isEmailConfigured } from "@/lib/email/mailer";
import { requireAppContext } from "@/lib/data/context";
import { getWorkspaceSettings, listInvites, listMembers, modelInfo, monthStart } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Settings" };

async function SettingsPageContent() {
  const ctx = await requireAppContext();
  const [settings, members, invites, monthTasks, prefs, claims] = await Promise.all([
    getWorkspaceSettings(ctx),
    listMembers(ctx),
    listInvites(ctx),
    ctx.supabase.from("tasks").select("cost_cents").eq("workspace_id", ctx.workspace.id).gte("started_at", monthStart()),
    ctx.supabase
      .from("notification_preferences")
      .select("prefs")
      .eq("user_id", ctx.user.id)
      .eq("workspace_id", ctx.workspace.id)
      .maybeSingle(),
    ctx.supabase.auth.getClaims(),
  ]);

  const appMetadata = claims.data?.claims.app_metadata as { providers?: string[] } | undefined;
  const tasks = monthTasks.data ?? [];

  return (
    <SettingsView
      settings={settings}
      members={members}
      invites={invites}
      myId={ctx.user.id}
      myRole={ctx.workspace.role}
      model={modelInfo()}
      monthSpendCents={tasks.reduce((sum, t) => sum + t.cost_cents, 0)}
      monthTasks={tasks.length}
      notificationPrefs={(prefs.data?.prefs as NotificationPrefs | null) ?? {}}
      signInMethods={appMetadata?.providers ?? ["email"]}
      emailConfigured={isEmailConfigured()}
    />
  );
}

/** Shows a placeholder straight away while this page's data loads. */
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}
