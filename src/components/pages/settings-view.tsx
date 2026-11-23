"use client";

import { Bell, Building2, Copy, CreditCard, Cpu, KeyRound, Lock, Receipt, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import type { WorkspaceRole } from "@/lib/data/context";
import { formatCents } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import type { InviteRecord, MemberRecord, ModelInfo, WorkspaceSettings } from "@/types/app-data";
import type { Json } from "@/types/database";

type TabId = "workspace" | "team" | "ai" | "notifications" | "security" | "billing";

const tabs: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "ai", label: "AI & spending", icon: Cpu },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "billing", label: "Usage & billing", icon: CreditCard },
];

const ROLE_LABEL: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
const ROLE_DESCRIPTION: Record<WorkspaceRole, string> = {
  owner: "Everything, including spending limits, team and deleting the workspace.",
  admin: "Invite people, change roles, edit business instructions and spending limits.",
  member: "Use Ask Baba, create and run workflows, download files.",
  viewer: "Read conversations, activity and files. Can't start tasks.",
};

const NOTIFICATION_EVENTS = [
  { key: "task_finished", label: "Task finished" },
  { key: "task_failed", label: "Task failed" },
  { key: "paused_at_cap", label: "Paused at spending cap" },
  { key: "approval_needed", label: "Approval needed" },
  { key: "weekly_summary", label: "Weekly summary email" },
] as const;
export type NotificationPrefs = Record<string, { email: boolean; app: boolean }>;

const TIMEZONES = ["UTC", "Europe/London", "Europe/Paris", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "America/New_York", "America/Chicago", "America/Los_Angeles"];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function Field({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function ReadOnlyNote() {
  return <p className="text-xs text-subtle">Only owners and admins can change these settings.</p>;
}

type SettingsViewProps = {
  settings: WorkspaceSettings;
  members: MemberRecord[];
  invites: InviteRecord[];
  myId: string;
  myRole: WorkspaceRole;
  model: ModelInfo;
  monthSpendCents: number;
  monthTasks: number;
  notificationPrefs: NotificationPrefs;
  signInMethods: string[];
};

export function SettingsView({
  settings,
  members,
  invites,
  myId,
  myRole,
  model,
  monthSpendCents,
  monthTasks,
  notificationPrefs,
  signInMethods,
}: SettingsViewProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const { toast, showToast } = useToast();
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const [tab, setTab] = useState<TabId>("workspace");
  const [busy, setBusy] = useState<string | null>(null);

  // Workspace
  const [ws, setWs] = useState({
    name: settings.name,
    industry: settings.industry ?? "",
    companySize: settings.companySize ?? "",
    timezone: settings.timezone,
  });
  const [wsError, setWsError] = useState<string | null>(null);

  // Spending
  const [caps, setCaps] = useState({ task: settings.taskCapUsd.toFixed(2), month: settings.monthlyLimitUsd.toFixed(2) });
  const [capErrors, setCapErrors] = useState<{ task?: string; month?: string }>({});

  // Team
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ email: string; role: WorkspaceRole }>({ email: "", role: "member" });
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Notifications
  const [notify, setNotify] = useState<NotificationPrefs>(() =>
    Object.fromEntries(
      NOTIFICATION_EVENTS.map(({ key }) => [key, notificationPrefs[key] ?? { email: true, app: key !== "weekly_summary" }]),
    ),
  );

  // Delete workspace
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function run(key: string, action: () => PromiseLike<{ error: { message: string } | null }>, success: string, failure: string) {
    setBusy(key);
    const { error } = await action();
    setBusy(null);
    if (error) {
      showToast(`${failure}${error.message ? ` (${error.message})` : ""}`);
      return false;
    }
    showToast(success);
    router.refresh();
    return true;
  }

  async function saveWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!ws.name.trim()) {
      setWsError("Enter a workspace name.");
      return;
    }
    setWsError(null);
    await run(
      "workspace",
      () =>
        supabase
          .from("workspaces")
          .update({
            name: ws.name.trim().slice(0, 100),
            industry: ws.industry || null,
            company_size: ws.companySize || null,
            timezone: ws.timezone,
          })
          .eq("id", settings.id),
      "Workspace saved.",
      "Couldn't save the workspace.",
    );
  }

  async function saveSpending(event: FormEvent) {
    event.preventDefault();
    const task = Number(caps.task);
    const month = Number(caps.month);
    const next = {
      task: Number.isFinite(task) && task >= 0.01 && task <= 1000 ? undefined : "Enter an amount between 0.01 and 1000.",
      month: Number.isFinite(month) && month >= 1 ? (month < task ? "Must be at least the per-conversation cap." : undefined) : "Enter at least 1.",
    };
    setCapErrors(next);
    if (next.task || next.month) return;
    await run(
      "spending",
      () =>
        supabase
          .from("workspaces")
          .update({ task_cap_usd: Math.round(task * 100) / 100, monthly_limit_usd: Math.round(month * 100) / 100 })
          .eq("id", settings.id),
      "Spending settings saved. New conversations use the new cap.",
      "Couldn't save spending settings.",
    );
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    const email = invite.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === email)) {
      setInviteError("That person is already in this workspace.");
      return;
    }
    setInviteError(null);
    setBusy("invite");
    const { error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: settings.id, email, role: invite.role, invited_by: myId });
    setBusy(null);
    if (error) {
      setInviteError(error.code === "23505" ? "There's already a pending invite for that email." : "Couldn't create the invite.");
      return;
    }
    setInviteOpen(false);
    setInvite({ email: "", role: "member" });
    showToast("Invite created. Share the sign-up link with them.");
    router.refresh();
  }

  function copySignUpLink(email: string) {
    const link = `${window.location.origin}${routes.signUp}?email=${encodeURIComponent(email)}`;
    void navigator.clipboard?.writeText(link).then(
      () => showToast("Sign-up link copied."),
      () => showToast(link),
    );
  }

  async function saveNotifications() {
    await run(
      "notifications",
      () =>
        supabase
          .from("notification_preferences")
          .upsert({ user_id: myId, workspace_id: settings.id, prefs: notify as unknown as Json, updated_at: new Date().toISOString() }),
      "Notification choices saved.",
      "Couldn't save notification choices.",
    );
  }

  async function signOutOthers() {
    setBusy("sessions");
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    showToast(error ? "Couldn't sign out other devices." : "Signed out of all other devices.");
  }

  async function leaveWorkspace() {
    if (!window.confirm(`Leave ${settings.name}? You'll lose access to its conversations and files.`)) return;
    const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", settings.id).eq("user_id", myId);
    if (error) {
      showToast("Couldn't leave the workspace.");
      return;
    }
    window.location.assign(routes.dashboard);
  }

  async function deleteWorkspace() {
    setBusy("delete");
    setDeleteError(null);
    const { error } = await supabase.from("workspaces").delete().eq("id", settings.id);
    setBusy(null);
    if (error) {
      setDeleteError("Couldn't delete the workspace. Only the owner can do this.");
      return;
    }
    window.location.assign(routes.dashboard);
  }

  const limitCents = Math.round(settings.monthlyLimitUsd * 100);
  const usedPct = Math.min(100, Math.round((monthSpendCents / Math.max(1, limitCents)) * 100));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={`Workspace, team, spending and security for ${settings.name}.`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div role="tablist" aria-label="Settings sections" aria-orientation="vertical" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:col-span-3 lg:mx-0 lg:flex-col lg:self-start lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-control px-3 text-sm font-medium transition-colors",
                tab === t.id ? "bg-surface-raised text-accent" : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <t.icon aria-hidden="true" className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6 lg:col-span-9">
          {tab === "workspace" && (
            <Section title="Workspace" description="General information about your company. Baba can use it to tailor its work.">
              <form noValidate onSubmit={saveWorkspace} className="space-y-6">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-card border border-border-strong bg-surface-raised text-2xl font-bold text-accent">
                    {(ws.name.trim()[0] ?? "W").toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{settings.name}</p>
                    <p className="text-xs text-subtle">Your role: {ROLE_LABEL[myRole]}</p>
                  </div>
                </div>
                <fieldset disabled={!canManage} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input id="ws-name" label="Workspace name" required value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} error={wsError ?? undefined} />
                  <Field id="ws-industry" label="Industry">
                    <select id="ws-industry" value={ws.industry} onChange={(e) => setWs({ ...ws, industry: e.target.value })} className={selectClasses}>
                      <option value="">Not set</option>
                      <option value="software">Software & SaaS</option>
                      <option value="retail">Retail & e-commerce</option>
                      <option value="food">Food & hospitality</option>
                      <option value="agency">Agency & consulting</option>
                      <option value="finance">Finance</option>
                      <option value="health">Health & wellness</option>
                      <option value="education">Education</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field id="ws-size" label="Company size">
                    <select id="ws-size" value={ws.companySize} onChange={(e) => setWs({ ...ws, companySize: e.target.value })} className={selectClasses}>
                      <option value="">Not set</option>
                      <option value="1-10">1–10 people</option>
                      <option value="11-50">11–50 people</option>
                      <option value="51-200">51–200 people</option>
                      <option value="201+">201+ people</option>
                    </select>
                  </Field>
                  <Field id="ws-tz" label="Timezone">
                    <select id="ws-tz" value={ws.timezone} onChange={(e) => setWs({ ...ws, timezone: e.target.value })} className={selectClasses}>
                      {(TIMEZONES.includes(ws.timezone) ? TIMEZONES : [ws.timezone, ...TIMEZONES]).map((tz) => (
                        <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                      ))}
                    </select>
                  </Field>
                </fieldset>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" loading={busy === "workspace"} loadingText="Saving…">Save changes</Button>
                  </div>
                ) : (
                  <ReadOnlyNote />
                )}
              </form>
            </Section>
          )}

          {tab === "team" && (
            <Section title="Team" description="Who can use this workspace, and what they can do.">
              {canManage && (
                <div className="flex justify-end">
                  <Button onClick={() => { setInviteError(null); setInviteOpen(true); }}>
                    <UserPlus aria-hidden="true" className="size-4" />
                    Invite member
                  </Button>
                </div>
              )}
              <ul className="divide-y divide-border rounded-xl border border-border">
                {members.map((m) => {
                  const isMe = m.userId === myId;
                  const editable = canManage && !isMe && m.role !== "owner";
                  return (
                    <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={m.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {m.name} {isMe && <span className="text-xs text-subtle">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editable ? (
                          <>
                            <label htmlFor={`role-${m.userId}`} className="sr-only">Role for {m.name}</label>
                            <select
                              id={`role-${m.userId}`}
                              value={m.role}
                              disabled={busy === `role-${m.userId}`}
                              onChange={(e) =>
                                void run(
                                  `role-${m.userId}`,
                                  () => supabase.from("workspace_members").update({ role: e.target.value as WorkspaceRole }).eq("workspace_id", settings.id).eq("user_id", m.userId),
                                  `${m.name} is now ${ROLE_LABEL[e.target.value as WorkspaceRole]}.`,
                                  "Couldn't change the role.",
                                )
                              }
                              className={cn(selectClasses, "h-9 w-28 text-xs")}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            {isOwner && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (!window.confirm(`Make ${m.name} the owner? You'll become an admin.`)) return;
                                  void run(`owner-${m.userId}`, () => supabase.rpc("transfer_ownership", { ws: settings.id, new_owner: m.userId }), `${m.name} is now the owner.`, "Couldn't transfer ownership.");
                                }}
                              >
                                Make owner
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                              onClick={() => {
                                if (!window.confirm(`Remove ${m.name} from ${settings.name}?`)) return;
                                void run(`remove-${m.userId}`, () => supabase.from("workspace_members").delete().eq("workspace_id", settings.id).eq("user_id", m.userId), `${m.name} was removed.`, "Couldn't remove them.");
                              }}
                            >
                              Remove
                            </Button>
                          </>
                        ) : (
                          <Badge tone={m.role === "owner" ? "accent" : m.role === "admin" ? "info" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                        )}
                        {isMe && !isOwner && (
                          <Button size="sm" variant="ghost" className="text-danger" onClick={leaveWorkspace}>
                            Leave
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name="?" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{i.email}</p>
                        <p className="truncate text-xs text-muted">
                          Invited <LocalTime iso={i.createdAt} format="relative" /> · expires <LocalTime iso={i.expiresAt} format="date" />
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{ROLE_LABEL[i.role]}</Badge>
                      <Badge tone="warning">Pending</Badge>
                      <Button size="sm" variant="ghost" onClick={() => copySignUpLink(i.email)}>
                        <Copy aria-hidden="true" className="size-3.5" />
                        Copy link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => void run(`revoke-${i.id}`, () => supabase.from("workspace_invites").update({ status: "revoked" }).eq("id", i.id), "Invite revoked.", "Couldn't revoke the invite.")}
                      >
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {canManage && (
                <p className="text-xs text-subtle">
                  Invite emails aren&apos;t sent automatically yet. Share the sign-up link: when they sign up with the invited
                  email they join this workspace. If they already have a Baba account, they&apos;ll find the invite in their
                  workspace menu.
                </p>
              )}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">What each role can do</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.keys(ROLE_DESCRIPTION) as WorkspaceRole[]).map((role) => (
                    <div key={role} className="rounded-control border border-border bg-surface-raised p-3">
                      <dt className="text-sm font-semibold text-foreground">{ROLE_LABEL[role]}</dt>
                      <dd className="mt-1 text-xs text-muted">{ROLE_DESCRIPTION[role]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Section>
          )}

          {tab === "ai" && (
            <Section title="AI & spending" description="Keep costs predictable and stay in control of what Baba does.">
              <div className="rounded-xl border border-border bg-surface-raised p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Spent this month</span>
                  <span className="font-semibold text-foreground">
                    {formatCents(monthSpendCents)} <span className="font-normal text-subtle">of {formatCents(limitCents)}</span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly limit used">
                  <div className={cn("h-full rounded-full", usedPct >= 90 ? "bg-danger" : usedPct >= 70 ? "bg-warning" : "bg-accent")} style={{ width: `${usedPct}%` }} />
                </div>
              </div>
              <form noValidate onSubmit={saveSpending} className="space-y-6">
                <fieldset disabled={!canManage} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="cap-task"
                    type="number"
                    min="0.01"
                    step="0.01"
                    label="Spending cap per conversation ($)"
                    value={caps.task}
                    onChange={(e) => setCaps({ ...caps, task: e.target.value })}
                    error={capErrors.task}
                    hint="Baba pauses when a conversation reaches this. Click Continue to add the same amount again."
                  />
                  <Input
                    id="cap-month"
                    type="number"
                    min="1"
                    step="1"
                    label="Monthly spending limit ($)"
                    value={caps.month}
                    onChange={(e) => setCaps({ ...caps, month: e.target.value })}
                    error={capErrors.month}
                    hint="New tasks are blocked once the workspace spends this much in a month."
                  />
                </fieldset>
                <div className="rounded-xl border border-border bg-surface-raised p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Model: <span className="text-accent">{model.label}</span>
                    {model.testMode && <Badge tone="warning" className="ml-2">Test mode</Badge>}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {model.testMode
                      ? "Running on the cheapest model while you test. It switches to Claude Sonnet 5.5 for full quality when testing is done."
                      : "Strong quality at a sensible cost for every agent."}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-raised p-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Lock aria-hidden="true" className="size-4 text-warning" />
                      Always ask before sensitive actions
                    </p>
                    <p className="mt-1 text-xs text-muted">Sending emails, posting messages and changing records always need approval. This can&apos;t be turned off.</p>
                  </div>
                  <Switch checked disabled label="Always ask before sensitive actions (always on)" />
                </div>
                {canManage ? (
                  <div className="flex justify-end">
                    <Button type="submit" loading={busy === "spending"} loadingText="Saving…">Save spending settings</Button>
                  </div>
                ) : (
                  <ReadOnlyNote />
                )}
              </form>
            </Section>
          )}

          {tab === "notifications" && (
            <Section title="Notifications" description="Choose how Baba lets you know what's happening. These are your personal choices.">
              <Alert variant="info">Your choices are saved now. Emails and in-app alerts start once notification sending is switched on.</Alert>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-subtle">
                    <th scope="col" className="pb-3 font-medium">Event</th>
                    <th scope="col" className="w-16 pb-3 text-center font-medium">Email</th>
                    <th scope="col" className="w-16 pb-3 text-center font-medium">In-app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {NOTIFICATION_EVENTS.map(({ key, label }) => (
                    <tr key={key}>
                      <td className="py-3 pr-3 text-foreground">{label}</td>
                      {(["email", "app"] as const).map((channel) => (
                        <td key={channel} className="py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${label} by ${channel === "email" ? "email" : "in-app notification"}`}
                            checked={notify[key][channel]}
                            onChange={(e) => setNotify({ ...notify, [key]: { ...notify[key], [channel]: e.target.checked } })}
                            className="size-4 accent-accent"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <Button onClick={saveNotifications} loading={busy === "notifications"} loadingText="Saving…">Save notifications</Button>
              </div>
            </Section>
          )}

          {tab === "security" && (
            <>
              <Section title="Sign-in methods" description="How you sign in to Baba.">
                <ul className="space-y-2">
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="flex items-center gap-3 text-sm text-foreground">
                      <KeyRound aria-hidden="true" className="size-4 text-accent" /> Email and password
                    </span>
                    {signInMethods.includes("email") ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Not set up</Badge>}
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="text-sm text-foreground">Google</span>
                    {signInMethods.includes("google") ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Not linked</Badge>}
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="text-sm text-foreground">
                      Two-step verification <span className="text-xs text-subtle">· Off</span>
                    </span>
                    <Badge tone="neutral">Coming soon</Badge>
                  </li>
                </ul>
              </Section>
              <Section title="Sessions" description="Signed in on a shared or lost device? Sign it out from here.">
                <Button variant="secondary" onClick={signOutOthers} loading={busy === "sessions"} loadingText="Signing out…">
                  Sign out of all other devices
                </Button>
              </Section>
              {isOwner ? (
                <Card className="border-danger/30 bg-danger/5 p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-danger">Delete workspace</h2>
                  <p className="mt-1 text-sm text-muted">
                    Permanently deletes {settings.name} with all its conversations, files, workflows and activity, for every
                    member. This can&apos;t be undone.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-4 border-danger text-danger hover:bg-danger/10"
                    onClick={() => {
                      setConfirmName("");
                      setDeleteError(null);
                      setDeleteOpen(true);
                    }}
                  >
                    Delete workspace
                  </Button>
                </Card>
              ) : (
                <p className="text-xs text-subtle">Only the owner can delete this workspace.</p>
              )}
            </>
          )}

          {tab === "billing" && (
            <Section title="Usage & billing" description="Your plan and what you've used this month.">
              <div className="flex flex-col justify-between gap-4 rounded-card border border-border bg-surface-raised p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xl font-bold text-foreground">Testing</p>
                  <p className="mt-1 text-xs text-muted">Plans and payments aren&apos;t set up yet. AI usage is charged to your own Anthropic account for now.</p>
                </div>
                <Badge tone="neutral">Plans coming soon</Badge>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">This month</h3>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-border rounded-xl border border-border">
                    {[
                      ["Tasks", String(monthTasks)],
                      ["Spend (list prices)", formatCents(monthSpendCents)],
                      ["Monthly limit", formatCents(limitCents)],
                      ["Team members", String(members.length)],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row" className="px-4 py-3 font-medium text-foreground">{k}</th>
                        <td className="px-4 py-3 text-right text-muted">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-border bg-surface-raised/40 p-8 text-center">
                <Receipt aria-hidden="true" className="mx-auto mb-2 size-6 text-subtle" />
                <p className="text-sm font-medium text-foreground">No invoices yet</p>
              </div>
            </Section>
          )}
        </div>
      </div>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} side="center" title="Invite a team member">
        <form noValidate className="space-y-4 p-4" onSubmit={sendInvite}>
          {inviteError && <Alert variant="error">{inviteError}</Alert>}
          <Input id="invite-email" type="email" label="Work email" required placeholder="colleague@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <Field id="invite-role" label="Role" hint={ROLE_DESCRIPTION[invite.role]}>
            <select id="invite-role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as WorkspaceRole })} className={selectClasses}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy === "invite"} loadingText="Creating…">Create invite</Button>
          </div>
        </form>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} side="center" title="Delete workspace">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            This permanently deletes <strong className="text-foreground">{settings.name}</strong>. Type the workspace name to confirm.
          </p>
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <Input id="delete-confirm" label="Workspace name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={settings.name} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={confirmName.trim() !== settings.name} loading={busy === "delete"} loadingText="Deleting…" onClick={deleteWorkspace}>
              Delete workspace
            </Button>
          </div>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
