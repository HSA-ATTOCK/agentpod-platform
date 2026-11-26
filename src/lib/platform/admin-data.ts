import "server-only";
import { isEmailConfigured } from "@/lib/email/mailer";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import type { AccountStatus } from "./account";
import type { AdminContext } from "./admin";

/** Read-only queries for the admin dashboard. All take an AdminContext (secret-key client). */

const DAY = 86_400_000;

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  status: AccountStatus;
  isAdmin: boolean;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  lastSignIn: string | null;
  emailConfirmed: boolean;
  workspaces: { id: string; name: string; role: string }[];
  spend30dCents: number;
  tasks30d: number;
};

/** Every account with status, workspaces and 30-day usage. */
export async function listAdminUsers(ctx: AdminContext, status?: AccountStatus): Promise<AdminUser[]> {
  let accountsQuery = ctx.db.from("platform_accounts").select("user_id, status, is_admin, status_reason, created_at, reviewed_at").order("created_at", { ascending: false }).limit(1000);
  if (status) accountsQuery = accountsQuery.eq("status", status);
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [{ data: accounts }, { data: profiles }, { data: members }, { data: tasks }, authUsers] = await Promise.all([
    accountsQuery,
    ctx.db.from("profiles").select("id, email, full_name").limit(5000),
    ctx.db.from("workspace_members").select("user_id, role, workspaces (id, name)").limit(10000),
    ctx.db.from("tasks").select("created_by, cost_cents").gte("started_at", since).limit(20000),
    ctx.db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const auth = new Map((authUsers.data?.users ?? []).map((u) => [u.id, u]));
  const profileOf = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (accounts ?? []).map((a) => {
    const p = profileOf.get(a.user_id);
    const u = auth.get(a.user_id);
    const mine = (tasks ?? []).filter((t) => t.created_by === a.user_id);
    return {
      id: a.user_id,
      email: p?.email ?? u?.email ?? "(unknown)",
      name: p?.full_name || p?.email || "",
      status: a.status,
      isAdmin: a.is_admin,
      reason: a.status_reason,
      createdAt: a.created_at,
      reviewedAt: a.reviewed_at,
      lastSignIn: u?.last_sign_in_at ?? null,
      emailConfirmed: Boolean(u?.email_confirmed_at),
      workspaces: (members ?? [])
        .filter((m) => m.user_id === a.user_id && m.workspaces)
        .map((m) => ({ id: m.workspaces!.id, name: m.workspaces!.name, role: m.role })),
      spend30dCents: mine.reduce((s, t) => s + (t.cost_cents ?? 0), 0),
      tasks30d: mine.length,
    };
  });
}

export type AdminWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  members: number;
  ownerEmail: string | null;
  ownMonthlyLimitUsd: number;
  spendMonthCents: number;
  limits: { planId: string | null; monthlyLimitUsd: number | null; dailyLimitUsd: number | null; allowedAgents: string[] | null; note: string | null } | null;
  integrations: number;
  workflows: number;
};

export async function listAdminWorkspaces(ctx: AdminContext): Promise<AdminWorkspace[]> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: workspaces }, { data: members }, { data: profiles }, { data: tasks }, { data: limits }, { data: integrations }, { data: workflows }] =
    await Promise.all([
      ctx.db.from("workspaces").select("id, name, created_at, monthly_limit_usd").order("created_at", { ascending: false }).limit(2000),
      ctx.db.from("workspace_members").select("workspace_id, user_id, role").limit(10000),
      ctx.db.from("profiles").select("id, email").limit(5000),
      ctx.db.from("tasks").select("workspace_id, cost_cents").gte("started_at", monthStart.toISOString()).limit(20000),
      ctx.db.from("workspace_limits").select("*"),
      ctx.db.from("integrations").select("workspace_id").limit(10000),
      ctx.db.from("workflows").select("workspace_id").limit(10000),
    ]);
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  return (workspaces ?? []).map((w) => {
    const ws = (members ?? []).filter((m) => m.workspace_id === w.id);
    const owner = ws.find((m) => m.role === "owner");
    const l = (limits ?? []).find((x) => x.workspace_id === w.id);
    return {
      id: w.id,
      name: w.name,
      createdAt: w.created_at,
      members: ws.length,
      ownerEmail: owner ? (emailOf.get(owner.user_id) ?? null) : null,
      ownMonthlyLimitUsd: Number(w.monthly_limit_usd),
      spendMonthCents: (tasks ?? []).filter((t) => t.workspace_id === w.id).reduce((s, t) => s + (t.cost_cents ?? 0), 0),
      limits: l
        ? {
            planId: l.plan_id,
            monthlyLimitUsd: l.monthly_limit_usd === null ? null : Number(l.monthly_limit_usd),
            dailyLimitUsd: l.daily_limit_usd === null ? null : Number(l.daily_limit_usd),
            allowedAgents: l.allowed_agents,
            note: l.note,
          }
        : null,
      integrations: (integrations ?? []).filter((i) => i.workspace_id === w.id).length,
      workflows: (workflows ?? []).filter((i) => i.workspace_id === w.id).length,
    };
  });
}

export async function listPlans(ctx: AdminContext) {
  const { data } = await ctx.db.from("subscription_plans").select("*").order("sort");
  return data ?? [];
}

export async function listAgents(ctx: AdminContext) {
  const { data } = await ctx.db.from("agent_registry").select("*").order("sort");
  return data ?? [];
}

export type Overview = {
  users: Record<AccountStatus, number> & { total: number };
  activeUsers7d: number;
  tasks30d: { total: number; succeeded: number; failed: number; running: number };
  spend: { todayCents: number; monthCents: number; days30Cents: number };
  byAgent: { name: string; tasks: number; cents: number }[];
  topRequests: { request: string; cents: number; workspaceId: string }[];
  daily: { day: string; cents: number; tasks: number }[];
  integrations: Record<string, number>;
  workflows: { total: number; enabled: number; failed30d: number };
};

export async function overview(ctx: AdminContext): Promise<Overview> {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: accounts }, { data: tasks }, { data: integrations }, { data: workflows }] = await Promise.all([
    ctx.db.from("platform_accounts").select("status"),
    ctx.db.from("tasks").select("status, cost_cents, started_at, agents, created_by, request, workspace_id, workflow_id").gte("started_at", since30).limit(20000),
    ctx.db.from("integrations").select("provider"),
    ctx.db.from("workflows").select("enabled"),
  ]);

  const users = { pending_approval: 0, approved: 0, rejected: 0, suspended: 0, deactivated: 0, total: 0 };
  for (const a of accounts ?? []) {
    users[a.status]++;
    users.total++;
  }
  const t = tasks ?? [];
  const sum = (rows: typeof t) => rows.reduce((s, r) => s + (r.cost_cents ?? 0), 0);
  const agentMap = new Map<string, { tasks: number; cents: number }>();
  for (const task of t) {
    const names = task.agents?.length ? task.agents : ["Baba"];
    for (const name of names) {
      const entry = agentMap.get(name) ?? { tasks: 0, cents: 0 };
      entry.tasks++;
      // Split a task's cost evenly between the agents that worked on it (an estimate)
      entry.cents += (task.cost_cents ?? 0) / names.length;
      agentMap.set(name, entry);
    }
  }
  const daily = new Map<string, { cents: number; tasks: number }>();
  for (let i = 29; i >= 0; i--) daily.set(new Date(now - i * DAY).toISOString().slice(0, 10), { cents: 0, tasks: 0 });
  for (const task of t) {
    const d = daily.get(task.started_at.slice(0, 10));
    if (d) {
      d.cents += task.cost_cents ?? 0;
      d.tasks++;
    }
  }
  const integrationCounts: Record<string, number> = {};
  for (const i of integrations ?? []) integrationCounts[i.provider] = (integrationCounts[i.provider] ?? 0) + 1;

  return {
    users,
    activeUsers7d: new Set(t.filter((x) => Date.parse(x.started_at) > now - 7 * DAY).map((x) => x.created_by)).size,
    tasks30d: {
      total: t.length,
      succeeded: t.filter((x) => x.status === "succeeded").length,
      failed: t.filter((x) => x.status === "failed").length,
      running: t.filter((x) => x.status === "running" || x.status === "needs_approval").length,
    },
    spend: {
      todayCents: sum(t.filter((x) => x.started_at >= todayStart.toISOString())),
      monthCents: sum(t.filter((x) => x.started_at >= monthStart.toISOString())),
      days30Cents: sum(t),
    },
    byAgent: [...agentMap.entries()].map(([name, v]) => ({ name, ...v, cents: Math.round(v.cents) })).sort((a, b) => b.cents - a.cents),
    topRequests: [...t]
      .sort((a, b) => (b.cost_cents ?? 0) - (a.cost_cents ?? 0))
      .slice(0, 8)
      .map((x) => ({ request: x.request, cents: x.cost_cents ?? 0, workspaceId: x.workspace_id })),
    daily: [...daily.entries()].map(([day, v]) => ({ day, ...v })),
    integrations: integrationCounts,
    workflows: {
      total: (workflows ?? []).length,
      enabled: (workflows ?? []).filter((w) => w.enabled).length,
      failed30d: t.filter((x) => x.workflow_id && x.status === "failed").length,
    },
  };
}

export async function listAudit(ctx: AdminContext, filter: { action?: string; limit?: number }) {
  let q = ctx.db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(filter.limit ?? 200);
  if (filter.action) q = q.ilike("action", `${filter.action.replace(/[%_]/g, "")}%`);
  const { data } = await q;
  return data ?? [];
}

export async function listFailedTasks(ctx: AdminContext) {
  const { data } = await ctx.db
    .from("tasks")
    .select("id, request, error, started_at, workspace_id, workflow_id")
    .eq("status", "failed")
    .order("started_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export type HealthCheck = { name: string; ok: boolean; detail: string };

/** Live checks of the platform's dependencies (never shows secret values). */
export async function healthChecks(ctx: AdminContext): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const started = Date.now();
  const { error } = await ctx.db.from("platform_settings").select("id").eq("id", 1).single();
  checks.push({ name: "Database", ok: !error, detail: error ? error.message : `Responding (${Date.now() - started} ms)` });
  checks.push({
    name: "Claude (Anthropic API)",
    ok: Boolean(process.env.ANTHROPIC_API_KEY && process.env.BABA_AGENT_ID && process.env.BABA_ENVIRONMENT_ID),
    detail: process.env.BABA_AGENT_ID ? "Key and agent configured" : "Missing ANTHROPIC_API_KEY or BABA_AGENT_ID (run npm run baba:setup)",
  });
  checks.push({ name: "Email (Gmail SMTP)", ok: isEmailConfigured(), detail: isEmailConfigured() ? "Configured" : "GMAIL_USER / GMAIL_APP_PASSWORD not set: emails are skipped" });
  checks.push({
    name: "Credential encryption",
    ok: Boolean(process.env.INTEGRATIONS_ENCRYPTION_KEY),
    detail: process.env.INTEGRATIONS_ENCRYPTION_KEY ? "Dedicated key set" : "Using a key derived from SUPABASE_SECRET_KEY (set INTEGRATIONS_ENCRYPTION_KEY for production)",
  });
  checks.push({ name: "Shared Google app", ok: true, detail: isGoogleConfigured() ? "Platform Google app configured" : "Not set (each workspace sets up its own from the chat)" });
  checks.push({
    name: "Scheduler",
    ok: process.env.BABA_SCHEDULER !== "off" || Boolean(process.env.CRON_SECRET),
    detail: process.env.BABA_SCHEDULER === "off" ? (process.env.CRON_SECRET ? "External cron (CRON_SECRET set)" : "Off and no CRON_SECRET: workflows won't run") : "Built-in timer (every minute)",
  });
  checks.push({
    name: "Public access",
    ok: true,
    detail: process.env.NODE_ENV === "production" ? (process.env.BABA_ALLOW_PUBLIC === "true" ? "Baba enabled for approved users" : "Baba switched off (BABA_ALLOW_PUBLIC not true)") : "Development server",
  });
  return checks;
}
