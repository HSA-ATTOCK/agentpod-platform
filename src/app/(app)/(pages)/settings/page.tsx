import type { Metadata } from "next";
import { SettingsView } from "@/components/pages/settings-view";
import type { NotificationPrefs } from "@/config/notifications";
import { isEmailConfigured } from "@/lib/email/mailer";
import { requireAppContext } from "@/lib/data/context";
import { getWorkspaceSettings, listInvites, listMembers, modelInfo, monthStart } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Settings" };

async function SettingsPageContent({ searchParams }: PageProps<"/settings">) {
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const [settings, members, invites, monthTasks, prefs, claims, briefing, profile] = await Promise.all([
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
    ctx.supabase.from("daily_briefings").select("enabled, send_hour").eq("user_id", ctx.user.id).eq("workspace_id", ctx.workspace.id).maybeSingle(),
    ctx.supabase.from("profiles").select("timezone").eq("id", ctx.user.id).maybeSingle(),
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
      briefing={{ enabled: briefing.data?.enabled ?? false, hour: briefing.data?.send_hour ?? 8 }}
      myTimeZone={profile.data?.timezone ?? "UTC"}
      initialTab={typeof params.tab === "string" ? params.tab : undefined}
    />
  );
}

/** Shows a placeholder straight away while this page's data loads. */
export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPageContent {...props} />
    </Suspense>
  );
}
