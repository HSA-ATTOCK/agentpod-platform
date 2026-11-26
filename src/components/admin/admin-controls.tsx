"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, inputClasses, selectClasses } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

/** Sends one action to /api/admin and refreshes the page. Throws with the server's message. */
async function adminPost(body: Record<string, unknown>) {
  const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
}

function useAdminAction() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    setError(null);
    try {
      await adminPost(body);
      showToast(done);
      router.refresh();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't save.";
      setError(message);
      showToast(message);
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, error, toast };
}

// ---------------------------------------------------------------------------
// Account actions (approve, reject, suspend, admin, reset, delete)
// ---------------------------------------------------------------------------

type AccountActionsProps = { userId: string; email: string; status: string; isAdmin: boolean; isSelf: boolean };

export function AccountActions({ userId, email, status, isAdmin, isSelf }: AccountActionsProps) {
  const { run, busy, toast } = useAdminAction();
  const [reasonFor, setReasonFor] = useState<"rejected" | "suspended" | null>(null);
  const [reason, setReason] = useState("");

  const setStatus = (s: string, why?: string) => run(s, { action: "account.status", userId, status: s, reason: why ?? "" }, "Account updated.");

  return (
    <div className="flex flex-wrap gap-1.5">
      {toast}
      {status !== "approved" && (
        <Button size="sm" loading={busy === "approved"} onClick={() => setStatus("approved")}>
          {status === "pending_approval" ? "Approve" : "Reactivate"}
        </Button>
      )}
      {status === "pending_approval" && (
        <Button size="sm" variant="secondary" onClick={() => setReasonFor("rejected")}>
          Reject
        </Button>
      )}
      {status === "approved" && !isSelf && (
        <Button size="sm" variant="secondary" onClick={() => setReasonFor("suspended")}>
          Suspend
        </Button>
      )}
      {status === "approved" && !isSelf && (
        <Button
          size="sm"
          variant="ghost"
          loading={busy === "admin"}
          onClick={() => {
            if (window.confirm(isAdmin ? `Remove platform admin rights from ${email}?` : `Make ${email} a platform administrator? They will be able to manage every account and setting.`)) {
              void run("admin", { action: "account.admin", userId, isAdmin: !isAdmin }, "Admin rights updated.");
            }
          }}
        >
          {isAdmin ? "Remove admin" : "Make admin"}
        </Button>
      )}
      <Button size="sm" variant="ghost" loading={busy === "reset"} onClick={() => run("reset", { action: "account.reset_password", userId }, `Password reset email sent to ${email}.`)}>
        Reset password
      </Button>
      {!isSelf && (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
          loading={busy === "delete"}
          onClick={() => {
            const typed = window.prompt(`Permanently delete ${email} and every workspace they own alone? Type DELETE to confirm.`);
            if (typed === "DELETE") void run("delete", { action: "account.delete", userId, confirm: "DELETE" }, "Account deleted.");
          }}
        >
          Delete
        </Button>
      )}

      <Sheet open={reasonFor !== null} onClose={() => setReasonFor(null)} side="center" title={reasonFor === "rejected" ? `Reject ${email}` : `Suspend ${email}`}>
        <form
          className="space-y-4 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (reasonFor && (await setStatus(reasonFor, reason))) {
              setReasonFor(null);
              setReason("");
            }
          }}
        >
          <label className="block text-sm font-medium text-foreground" htmlFor="reason">
            Reason (optional — shown to the person and sent in the email)
          </label>
          <textarea id="reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClasses} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setReasonFor(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy === reasonFor}>
              {reasonFor === "rejected" ? "Reject" : "Suspend"}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function AgentToggle({ agentKey, name, enabled, locked }: { agentKey: string; name: string; enabled: boolean; locked?: boolean }) {
  const { run, busy, toast } = useAdminAction();
  return (
    <>
      {toast}
      <Switch
        checked={enabled}
        disabled={locked || busy !== null}
        label={`${enabled ? "Turn off" : "Turn on"} ${name}`}
        onChange={(on) => run("toggle", { action: "agent.enabled", key: agentKey, enabled: on }, `${name} ${on ? "turned on" : "turned off"} for new conversations.`)}
      />
    </>
  );
}

export function SyncRosterButton() {
  const { run, busy, toast } = useAdminAction();
  return (
    <>
      {toast}
      <Button size="sm" variant="secondary" loading={busy === "sync"} onClick={() => run("sync", { action: "agent.sync" }, "Baba's team is in sync.")}>
        Re-apply team to Claude
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Workspace limits
// ---------------------------------------------------------------------------

type Option = { id: string; name: string };

export function WorkspaceLimitsButton(props: {
  workspaceId: string;
  workspaceName: string;
  plans: Option[];
  agents: { key: string; name: string }[];
  limits: { planId: string | null; monthlyLimitUsd: number | null; dailyLimitUsd: number | null; allowedAgents: string[] | null; note: string | null } | null;
}) {
  const { run, busy, error, toast } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    planId: props.limits?.planId ?? "",
    monthly: props.limits?.monthlyLimitUsd?.toString() ?? "",
    daily: props.limits?.dailyLimitUsd?.toString() ?? "",
    restrict: props.limits?.allowedAgents != null,
    agents: new Set(props.limits?.allowedAgents ?? props.agents.map((a) => a.key)),
    note: props.limits?.note ?? "",
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      "save",
      {
        action: "workspace.limits",
        workspaceId: props.workspaceId,
        planId: form.planId || null,
        monthlyLimitUsd: form.monthly || null,
        dailyLimitUsd: form.daily || null,
        allowedAgents: form.restrict ? [...form.agents] : null,
        note: form.note,
      },
      "Limits saved.",
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      {toast}
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Plan & limits
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title={`Limits: ${props.workspaceName}`}>
        <form onSubmit={save} className="space-y-4 p-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="Plan">
            <select className={selectClasses} value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">No plan (platform defaults)</option>
              {props.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Input id="monthly" label="Monthly AI spend limit (USD) — overrides the plan" inputMode="decimal" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} placeholder="From plan" />
          <Input id="daily" label="Daily AI spend limit (USD) — overrides the plan" inputMode="decimal" value={form.daily} onChange={(e) => setForm({ ...form, daily: e.target.value })} placeholder="From plan" />
          <div className="space-y-2 rounded-control border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={form.restrict} onChange={(e) => setForm({ ...form, restrict: e.target.checked })} />
              Only allow some specialist agents
            </label>
            {form.restrict && (
              <div className="grid gap-1.5 pl-6 sm:grid-cols-2">
                {props.agents.map((a) => (
                  <label key={a.key} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={form.agents.has(a.key)}
                      onChange={(e) => {
                        const next = new Set(form.agents);
                        if (e.target.checked) next.add(a.key);
                        else next.delete(a.key);
                        setForm({ ...form, agents: next });
                      }}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Field label="Internal note">
            <textarea rows={2} maxLength={500} className={inputClasses} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === "save"}>
              Save
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanRow = {
  id?: string;
  key: string;
  name: string;
  description: string;
  price_label: string;
  stripe_price_id: string | null;
  monthly_limit_usd: number;
  daily_limit_usd: number | null;
  task_cap_usd: number;
  max_workflows: number | null;
  max_integrations: number | null;
  max_previews: number | null;
  allowed_agents: string[] | null;
  features: string[];
  is_public: boolean;
  active: boolean;
  sort: number;
};

const EMPTY_PLAN: PlanRow = {
  key: "",
  name: "",
  description: "",
  price_label: "",
  stripe_price_id: null,
  monthly_limit_usd: 50,
  daily_limit_usd: null,
  task_cap_usd: 1,
  max_workflows: null,
  max_integrations: null,
  max_previews: null,
  allowed_agents: null,
  features: [],
  is_public: true,
  active: true,
  sort: 10,
};

export function PlanEditor({ plan, label }: { plan?: PlanRow; label: string }) {
  const { run, busy, error, toast } = useAdminAction();
  const [open, setOpen] = useState(false);
  const p = plan ?? EMPTY_PLAN;
  const [f, setF] = useState({
    key: p.key,
    name: p.name,
    description: p.description,
    priceLabel: p.price_label,
    stripePriceId: p.stripe_price_id ?? "",
    monthly: String(p.monthly_limit_usd),
    daily: p.daily_limit_usd?.toString() ?? "",
    cap: String(p.task_cap_usd),
    workflows: p.max_workflows?.toString() ?? "",
    integrations: p.max_integrations?.toString() ?? "",
    previews: p.max_previews?.toString() ?? "",
    agents: p.allowed_agents?.join(", ") ?? "",
    features: p.features.join("\n"),
    isPublic: p.is_public,
    active: p.active,
    sort: String(p.sort),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      "plan",
      {
        action: "plan.save",
        id: plan?.id,
        key: f.key,
        name: f.name,
        description: f.description,
        priceLabel: f.priceLabel,
        stripePriceId: f.stripePriceId,
        monthlyLimitUsd: f.monthly,
        dailyLimitUsd: f.daily || null,
        taskCapUsd: f.cap,
        maxWorkflows: f.workflows,
        maxIntegrations: f.integrations,
        maxPreviews: f.previews,
        allowedAgents: f.agents.trim() ? f.agents.split(",").map((s) => s.trim()).filter(Boolean) : null,
        features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
        isPublic: f.isPublic,
        active: f.active,
        sort: f.sort,
      },
      "Plan saved.",
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      {toast}
      <Button size="sm" variant={plan ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title={plan ? `Edit ${plan.name}` : "New plan"}>
        <form onSubmit={save} className="space-y-3 p-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input id="p-key" label="Key (a–z, 0–9, - _)" value={f.key} onChange={set("key")} disabled={Boolean(plan)} />
          <Input id="p-name" label="Name" value={f.name} onChange={set("name")} />
          <Input id="p-desc" label="Description" value={f.description} onChange={set("description")} />
          <Input id="p-price" label="Price shown to customers (e.g. $49 / month)" value={f.priceLabel} onChange={set("priceLabel")} />
          <Input id="p-stripe" label="Stripe Price ID (for online payment; optional)" placeholder="price_…" value={f.stripePriceId} onChange={set("stripePriceId")} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="p-monthly" label="Monthly limit (USD)" inputMode="decimal" value={f.monthly} onChange={set("monthly")} />
            <Input id="p-daily" label="Daily limit (USD)" inputMode="decimal" value={f.daily} onChange={set("daily")} placeholder="None" />
            <Input id="p-cap" label="Max cost per task (USD)" inputMode="decimal" value={f.cap} onChange={set("cap")} />
            <Input id="p-sort" label="Order" inputMode="numeric" value={f.sort} onChange={set("sort")} />
            <Input id="p-wf" label="Max workflows" inputMode="numeric" value={f.workflows} onChange={set("workflows")} placeholder="Unlimited" />
            <Input id="p-int" label="Max connections" inputMode="numeric" value={f.integrations} onChange={set("integrations")} placeholder="Unlimited" />
            <Input id="p-prev" label="Max website previews" inputMode="numeric" value={f.previews} onChange={set("previews")} placeholder="Unlimited" />
          </div>
          <Input id="p-agents" label="Allowed agent keys (comma separated; empty = all)" value={f.agents} onChange={set("agents")} />
          <Field label="Features (one per line)">
            <textarea rows={4} className={inputClasses} value={f.features} onChange={set("features")} />
          </Field>
          <div className="flex flex-wrap gap-6 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} /> Shown publicly
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === "plan"}>
              Save plan
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

type OutsideModel = { id: string; provider: "anthropic" | "openai" | "google"; model: string; label: string; inputPerMTok: number; outputPerMTok: number; fallback?: string };

export function SettingsForm(props: {
  requireApproval: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string;
  defaultMonthlyLimitUsd: number;
  defaultTaskCapUsd: number;
  externalModels: OutsideModel[];
  providers: Record<"anthropic" | "openai" | "google", boolean>;
}) {
  const { run, busy, error, toast } = useAdminAction();
  const { externalModels, providers, ...rest } = props;
  const [f, setF] = useState({ ...rest, defaultMonthlyLimitUsd: String(props.defaultMonthlyLimitUsd), defaultTaskCapUsd: String(props.defaultTaskCapUsd) });
  const [models, setModels] = useState(externalModels.map((m) => ({ ...m, inputPerMTok: String(m.inputPerMTok), outputPerMTok: String(m.outputPerMTok), fallback: m.fallback ?? "" })));
  const setModel = (i: number, patch: Partial<(typeof models)[number]>) => setModels(models.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          "settings",
          {
            action: "settings.save",
            ...f,
            externalModels: models.map((m) => ({ ...m, inputPerMTok: Number(m.inputPerMTok), outputPerMTok: Number(m.outputPerMTok), fallback: m.fallback || undefined })),
          },
          "Settings saved.",
        );
      }}
    >
      {toast}
      {error && <Alert variant="error">{error}</Alert>}
      <Row title="Approve new accounts" text="New sign-ups wait on a review screen until an administrator approves them. People invited to a workspace are approved automatically.">
        <Switch checked={f.requireApproval} label="Approve new accounts" onChange={(v) => setF({ ...f, requireApproval: v })} />
      </Row>
      <Row title="Maintenance mode" text="Only platform administrators can use the app and Baba. Everyone else sees the message below.">
        <Switch checked={f.maintenanceMode} label="Maintenance mode" onChange={(v) => setF({ ...f, maintenanceMode: v })} />
      </Row>
      <Input id="s-maint" label="Maintenance message" value={f.maintenanceMessage} onChange={(e) => setF({ ...f, maintenanceMessage: e.target.value })} />
      <Field label="Announcement banner (shown to every signed-in user; empty = none)">
        <textarea rows={2} maxLength={500} className={inputClasses} value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="s-monthly" label="Default monthly limit for new workspaces (USD)" inputMode="decimal" value={f.defaultMonthlyLimitUsd} onChange={(e) => setF({ ...f, defaultMonthlyLimitUsd: e.target.value })} />
        <Input id="s-cap" label="Default cost cap per task (USD)" inputMode="decimal" value={f.defaultTaskCapUsd} onChange={(e) => setF({ ...f, defaultTaskCapUsd: e.target.value })} />
      </div>
      <fieldset className="space-y-3 rounded-control border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">Other AI models for custom agents</legend>
        <p className="text-xs text-muted">
          Businesses can run their own agents on these. Prices (USD per million tokens) are used to enforce spending limits, so use the provider&apos;s current
          list prices. API keys: Anthropic {providers.anthropic ? "✓" : "missing"}, OpenAI (OPENAI_API_KEY) {providers.openai ? "✓" : "missing"}, Google (GEMINI_API_KEY){" "}
          {providers.google ? "✓" : "missing"}. Models whose key is missing are hidden from customers.
        </p>
        {models.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-control border border-border p-3 sm:grid-cols-4">
            <Input id={`m-id-${i}`} label="ID" value={m.id} onChange={(e) => setModel(i, { id: e.target.value })} placeholder="gpt-main" />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Provider</span>
              <select className={selectClasses} value={m.provider} onChange={(e) => setModel(i, { provider: e.target.value as OutsideModel["provider"] })}>
                <option value="openai">OpenAI</option>
                <option value="google">Google Gemini</option>
                <option value="anthropic">Anthropic (Messages API)</option>
              </select>
            </label>
            <Input id={`m-model-${i}`} label="Model name (as the provider calls it)" value={m.model} onChange={(e) => setModel(i, { model: e.target.value })} />
            <Input id={`m-label-${i}`} label="Shown to customers as" value={m.label} onChange={(e) => setModel(i, { label: e.target.value })} />
            <Input id={`m-in-${i}`} label="$ / 1M input tokens" inputMode="decimal" value={m.inputPerMTok} onChange={(e) => setModel(i, { inputPerMTok: e.target.value })} />
            <Input id={`m-out-${i}`} label="$ / 1M output tokens" inputMode="decimal" value={m.outputPerMTok} onChange={(e) => setModel(i, { outputPerMTok: e.target.value })} />
            <Input id={`m-fb-${i}`} label="Fallback model ID (optional)" value={m.fallback} onChange={(e) => setModel(i, { fallback: e.target.value })} />
            <div className="flex items-end">
              <Button variant="ghost" className="text-danger" onClick={() => setModels(models.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setModels([...models, { id: "", provider: "openai", model: "", label: "", inputPerMTok: "", outputPerMTok: "", fallback: "" }])}
        >
          Add a model
        </Button>
      </fieldset>
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={busy === "settings"}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-control border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent model
// ---------------------------------------------------------------------------

const MODEL_LABELS: Record<string, string> = {
  "": "Default (from team.mjs)",
  "claude-opus-5-5": "Claude Opus 5.5 — most capable, highest cost",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 — balanced",
  "claude-haiku-5-5": "Claude Haiku 5.5 — fastest, lowest cost",
};

export function AgentModelPicker({ agentKey, name, model, effort }: { agentKey: string; name: string; model: string | null; effort: string | null }) {
  const { run, busy, toast } = useAdminAction();
  const [m, setM] = useState(model ?? "");
  const [e, setE] = useState(effort ?? "medium");
  const changed = m !== (model ?? "") || (m !== "" && e !== (effort ?? "medium"));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {toast}
      <select aria-label={`Model for ${name}`} className={`${selectClasses} h-9 w-auto text-xs`} value={m} onChange={(ev) => setM(ev.target.value)}>
        {Object.entries(MODEL_LABELS).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      {m !== "" && (
        <select aria-label={`Effort for ${name}`} className={`${selectClasses} h-9 w-auto text-xs`} value={e} onChange={(ev) => setE(ev.target.value)}>
          <option value="low">Low effort</option>
          <option value="medium">Medium effort</option>
          <option value="high">High effort</option>
        </select>
      )}
      {changed && (
        <Button size="sm" loading={busy === "model"} onClick={() => run("model", { action: "agent.model", key: agentKey, model: m, effort: m ? e : "" }, m ? `${name} now uses ${m}.` : `${name} goes back to its default model on the next npm run baba:setup.`)}>
          Apply
        </Button>
      )}
    </div>
  );
}
