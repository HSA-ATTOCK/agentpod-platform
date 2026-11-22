"use client";

import { Bell, Building2, CreditCard, Cpu, KeyRound, Laptop, Lock, Receipt, ShieldCheck, Smartphone, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { roleDescriptions, sampleMembers, type TeamRole } from "@/lib/sample-pages";
import { cn } from "@/lib/utils";

type TabId = "workspace" | "team" | "ai" | "notifications" | "security" | "billing";

const tabs: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "ai", label: "AI & spending", icon: Cpu },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const SAVED = "Saved (sample — not connected yet).";

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

type SettingsViewProps = {
  /** The real per-conversation cap Baba uses now (from BABA_SESSION_BUDGET_USD). */
  currentCapUsd: string;
  /** The real agent profile (from BABA_PROFILE). */
  profile: "test" | "normal";
};

export function SettingsView({ currentCapUsd, profile }: SettingsViewProps) {
  const [tab, setTab] = useState<TabId>("workspace");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [quality, setQuality] = useState(profile === "test" ? "economy" : "balanced");
  const [notify, setNotify] = useState<Record<string, { email: boolean; app: boolean }>>({
    "Task finished": { email: true, app: true },
    "Task failed": { email: true, app: true },
    "Paused at spending cap": { email: true, app: true },
    "Approval needed": { email: true, app: true },
    "Weekly summary email": { email: true, app: false },
  });
  const { toast, showToast } = useToast();

  function saved(event?: FormEvent) {
    event?.preventDefault();
    showToast(SAVED);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace, team, spending and security for Acme Corp." sample />

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
            <Section title="Workspace" description="General information about your company.">
              <form onSubmit={saved} className="space-y-6">
                <div className="flex items-center gap-4 border-b border-border pb-6">
                  <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-card border border-border-strong bg-surface-raised text-2xl font-bold text-accent">A</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Workspace logo</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => showToast("Logo upload isn't available yet.")}>Change logo</Button>
                      <span className="text-xs text-subtle">PNG or JPG, up to 2 MB</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input id="ws-name" label="Workspace name" defaultValue="Acme Corp" required />
                  <Input id="ws-slug" label="Workspace URL name" defaultValue="acme-corp" hint="Used in links to your workspace." />
                  <Field id="ws-industry" label="Industry">
                    <select id="ws-industry" defaultValue="retail" className={selectClasses}>
                      <option value="software">Software & SaaS</option>
                      <option value="retail">Retail & e-commerce</option>
                      <option value="agency">Agency & consulting</option>
                      <option value="finance">Finance</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field id="ws-size" label="Company size">
                    <select id="ws-size" defaultValue="11-50" className={selectClasses}>
                      <option value="1-10">1–10 people</option>
                      <option value="11-50">11–50 people</option>
                      <option value="51-200">51–200 people</option>
                      <option value="201+">201+ people</option>
                    </select>
                  </Field>
                  <Field id="ws-tz" label="Timezone">
                    <select id="ws-tz" defaultValue="Europe/London" className={selectClasses}>
                      <option value="UTC">UTC</option>
                      <option value="Europe/London">London</option>
                      <option value="America/New_York">New York</option>
                      <option value="America/Los_Angeles">Los Angeles</option>
                      <option value="Asia/Karachi">Karachi</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            </Section>
          )}

          {tab === "team" && (
            <Section title="Team" description="Who can use this workspace, and what they can do.">
              <div className="flex justify-end">
                <Button onClick={() => setInviteOpen(true)}>
                  <UserPlus aria-hidden="true" className="size-4" />
                  Invite member
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {sampleMembers.map((m) => (
                  <li key={m.email} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={m.pending ? "?" : m.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {m.name} {m.role === "Owner" && <span className="text-xs text-subtle">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted">{m.pending ? "Invitation sent 2 days ago" : m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={m.role === "Owner" ? "accent" : m.role === "Admin" ? "info" : "neutral"}>{m.role}</Badge>
                      {m.pending ? (
                        <>
                          <Badge tone="warning">Pending</Badge>
                          <Button size="sm" variant="ghost" onClick={() => showToast("Invitations aren't connected yet.")}>Resend</Button>
                          <Button size="sm" variant="ghost" onClick={() => showToast("Invitations aren't connected yet.")}>Revoke</Button>
                        </>
                      ) : (
                        m.role !== "Owner" && (
                          <Button size="sm" variant="ghost" onClick={() => showToast("Changing roles isn't connected yet.")}>Edit</Button>
                        )
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">What each role can do</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.keys(roleDescriptions) as TeamRole[]).map((role) => (
                    <div key={role} className="rounded-control border border-border bg-surface-raised p-3">
                      <dt className="text-sm font-semibold text-foreground">{role}</dt>
                      <dd className="mt-1 text-xs text-muted">{roleDescriptions[role]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Section>
          )}

          {tab === "ai" && (
            <Section title="AI & spending" description="Keep costs predictable and stay in control of what Baba does.">
              <Alert variant="info" title="Current server settings">
                Baba is running in <strong className="text-foreground">{profile === "test" ? "test (cheapest)" : "normal"}</strong> mode with a cap of{" "}
                <strong className="text-foreground">${currentCapUsd}</strong> per conversation. For now these are set with{" "}
                <code className="text-foreground">BABA_PROFILE</code> and <code className="text-foreground">BABA_SESSION_BUDGET_USD</code> in{" "}
                <code className="text-foreground">.env.local</code>. Saving them here will work once accounts and a database exist.
              </Alert>
              <form onSubmit={saved} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="cap-task"
                    type="number"
                    min="0.05"
                    step="0.05"
                    label="Spending cap per task ($)"
                    defaultValue={currentCapUsd}
                    hint="Baba pauses when a task reaches this amount. You can continue it with one click."
                  />
                  <Input id="cap-month" type="number" min="1" step="1" label="Monthly spending limit ($)" defaultValue="50" hint="The most the whole workspace can spend in a month." />
                </div>
                <fieldset>
                  <legend className="mb-3 text-xs font-semibold text-muted">Default quality</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { id: "economy", name: "Economy", model: "Claude Haiku 5.5", text: "Cheapest. Good for simple tasks and testing." },
                      { id: "balanced", name: "Balanced", model: "Claude Sonnet 5.5", text: "Recommended. Strong quality at a sensible cost." },
                      { id: "best", name: "Best", model: "Claude Opus 5.5", text: "Highest quality for complex work. Costs the most." },
                    ].map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 transition-colors",
                          quality === option.id ? "border-accent bg-accent/5" : "border-border bg-surface-raised hover:border-border-strong",
                        )}
                      >
                        <input type="radio" name="quality" value={option.id} checked={quality === option.id} onChange={() => setQuality(option.id)} className="sr-only" />
                        <span className="block text-sm font-semibold text-foreground">{option.name}</span>
                        <span className="block text-xs font-medium text-accent">{option.model}</span>
                        <span className="mt-1 block text-xs text-subtle">{option.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
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
                <div className="flex justify-end">
                  <Button type="submit">Save spending settings</Button>
                </div>
              </form>
            </Section>
          )}

          {tab === "notifications" && (
            <Section title="Notifications" description="Choose how Baba lets you know what's happening.">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-subtle">
                    <th scope="col" className="pb-3 font-medium">Event</th>
                    <th scope="col" className="w-16 pb-3 text-center font-medium">Email</th>
                    <th scope="col" className="w-16 pb-3 text-center font-medium">In-app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(notify).map(([event, channels]) => (
                    <tr key={event}>
                      <td className="py-3 pr-3 text-foreground">{event}</td>
                      {(["email", "app"] as const).map((channel) => (
                        <td key={channel} className="py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${event} by ${channel === "email" ? "email" : "in-app notification"}`}
                            checked={channels[channel]}
                            onChange={(e) => setNotify({ ...notify, [event]: { ...channels, [channel]: e.target.checked } })}
                            className="size-4 accent-accent"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <Button onClick={() => saved()}>Save notifications</Button>
              </div>
            </Section>
          )}

          {tab === "security" && (
            <>
              <Section title="Sign-in methods">
                <ul className="space-y-2">
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="flex items-center gap-3 text-sm text-foreground">
                      <KeyRound aria-hidden="true" className="size-4 text-accent" /> Email and password
                    </span>
                    <Badge tone="success">On</Badge>
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="text-sm text-foreground">Google</span>
                    <Button size="sm" variant="secondary" onClick={() => showToast("Google sign-in isn't connected yet.")}>Connect</Button>
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                    <span className="text-sm text-foreground">
                      Two-step verification <span className="text-xs text-subtle">· Off</span>
                    </span>
                    <Button size="sm" variant="secondary" disabled>Coming soon</Button>
                  </li>
                </ul>
              </Section>
              <Section title="Active sessions">
                <ul className="space-y-2">
                  {[
                    { icon: Laptop, name: "Chrome on Windows", where: "Lahore, Pakistan · Active now", current: true },
                    { icon: Smartphone, name: "Safari on iPhone", where: "Lahore, Pakistan · 4 hours ago", current: false },
                  ].map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-raised p-3">
                      <span className="flex items-center gap-3">
                        <s.icon aria-hidden="true" className="size-4 text-muted" />
                        <span>
                          <span className="block text-sm text-foreground">{s.name}</span>
                          <span className="text-xs text-subtle">{s.where}</span>
                        </span>
                      </span>
                      {s.current ? (
                        <span className="text-xs text-success">This device</span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => showToast("Session management isn't connected yet.")}>Sign out</Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
              <Card className="border-danger/30 bg-danger/5 p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-danger">Delete workspace</h2>
                <p className="mt-1 text-sm text-muted">
                  Permanently deletes the workspace, its agent settings, files and activity. This can&apos;t be undone.
                </p>
                <Button
                  variant="secondary"
                  className="mt-4 border-danger text-danger hover:bg-danger/10"
                  onClick={() => {
                    setConfirmName("");
                    setDeleteOpen(true);
                  }}
                >
                  Delete workspace
                </Button>
              </Card>
            </>
          )}

          {tab === "billing" && (
            <Section title="Billing" description="Your plan and what you've used this month.">
              <div className="flex flex-col justify-between gap-4 rounded-card border border-border bg-surface-raised p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xl font-bold text-foreground">Testing</p>
                  <p className="mt-1 text-xs text-muted">Plans and billing aren&apos;t set up yet. Usage is charged to your own Anthropic account for now.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" disabled>Upgrade</Button>
                  <Badge tone="neutral">Plans coming soon</Badge>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Usage this month</h3>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-border rounded-xl border border-border">
                    {[
                      ["Tasks", "48"],
                      ["Web searches", "182"],
                      ["Agent time", "1h 14m"],
                      ["Spend (list prices)", "$6.72"],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row" className="px-4 py-3 font-medium text-foreground">{k}</th>
                        <td className="px-4 py-3 text-right text-muted">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-subtle">Sample figures. Your real spend is in the Claude Console.</p>
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
        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setInviteOpen(false);
            showToast("Invitations aren't connected yet — nothing was sent.");
          }}
        >
          <Input id="invite-email" type="email" label="Work email" required placeholder="colleague@acme.com" />
          <Field id="invite-role" label="Role">
            <select id="invite-role" defaultValue="Member" className={selectClasses}>
              <option>Admin</option>
              <option>Member</option>
              <option>Viewer</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit">Send invite</Button>
          </div>
        </form>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} side="center" title="Delete workspace">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            This permanently deletes <strong className="text-foreground">Acme Corp</strong>. Type the workspace name to confirm.
          </p>
          <Input id="delete-confirm" label="Workspace name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Acme Corp" />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={confirmName.trim() !== "Acme Corp"}
              onClick={() => {
                setDeleteOpen(false);
                showToast("Sample workspace — nothing was deleted.");
              }}
            >
              Delete workspace
            </Button>
          </div>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
