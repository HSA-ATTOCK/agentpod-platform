import "server-only";

/**
 * Limits the platform administrator sets for a workspace (its plan plus any overrides),
 * combined with the workspace's own settings. The stricter value always wins, and these
 * are checked on the server before every task (PRD §15.4: never left to the AI).
 */

type Db = {
  // Works with both the signed-in user's client (RLS: members can read their workspace's limits) and the secret-key client
  from: (table: "workspace_limits" | "subscription_plans") => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type PlatformLimits = {
  planName: string | null;
  monthlyLimitUsd: number | null;
  dailyLimitUsd: number | null;
  taskCapUsd: number | null;
  /** null = every enabled agent */
  allowedAgents: string[] | null;
  maxWorkflows: number | null;
  maxIntegrations: number | null;
  maxPreviews: number | null;
};

const NONE: PlatformLimits = {
  planName: null,
  monthlyLimitUsd: null,
  dailyLimitUsd: null,
  taskCapUsd: null,
  allowedAgents: null,
  maxWorkflows: null,
  maxIntegrations: null,
  maxPreviews: null,
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function platformLimits(db: Db, workspaceId: string): Promise<PlatformLimits> {
  const { data: limits } = await db.from("workspace_limits").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!limits) return NONE;
  const { data: plan } = limits.plan_id
    ? await db.from("subscription_plans").select("*").eq("id", limits.plan_id).maybeSingle()
    : { data: null };
  return {
    planName: plan?.name ?? null,
    monthlyLimitUsd: num(limits.monthly_limit_usd) ?? num(plan?.monthly_limit_usd),
    dailyLimitUsd: num(limits.daily_limit_usd) ?? num(plan?.daily_limit_usd),
    taskCapUsd: num(plan?.task_cap_usd),
    allowedAgents: limits.allowed_agents ?? plan?.allowed_agents ?? null,
    maxWorkflows: num(plan?.max_workflows),
    maxIntegrations: num(plan?.max_integrations),
    maxPreviews: num(plan?.max_previews),
  };
}

/** The stricter of two optional limits. */
export function stricter(own: number, platform: number | null) {
  return platform === null ? own : Math.min(own, platform);
}

/**
 * Names of specialist agents this workspace may NOT use (its plan or the admin restricted them).
 * Globally disabled agents aren't listed: they are already removed from Baba's team on Claude.
 */
export async function blockedAgentNames(db: { from: (table: "agent_registry") => any }, limits: PlatformLimits): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (limits.allowedAgents === null) return [];
  const { data } = await db.from("agent_registry").select("key, name, category");
  const rows = (data ?? []) as { key: string; name: string; category: string }[];
  return rows.filter((r) => r.category === "specialist" && !limits.allowedAgents!.includes(r.key)).map((r) => r.name);
}

/** The note Baba gets with a message when some specialists are off for this workspace. */
export function blockedAgentsNote(names: string[]) {
  return names.length
    ? `\n\n[Platform note: these specialists are not available for this workspace, so don't delegate to them: ${names.join(", ")}. Do that part yourself or tell me it isn't available.]`
    : "";
}
