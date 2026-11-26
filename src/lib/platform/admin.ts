import "server-only";
import { notFound } from "next/navigation";
import { routes } from "@/config/routes";
import { babaConfig, getClaude } from "@/lib/baba/server";
import { getAppContext, type AppContext } from "@/lib/data/context";
import { sendEmail } from "@/lib/email/mailer";
import { accountDecisionEmail } from "@/lib/email/templates";
import { serverOrigin } from "@/lib/origin";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import type { ExternalModel } from "@/lib/ai/gateway";
import type { Json, TablesUpdate } from "@/types/database";
import { audit, notifyInApp, type AccountStatus } from "./account";

/**
 * Master administration (PRD §3.1, §15). Everything here runs on the server with the
 * secret key, AFTER checking that the signed-in person is an approved platform admin.
 * There is no way to reach these actions from the browser without that check.
 */

export type AdminContext = AppContext & { db: ReturnType<typeof getSupabaseAdmin> };

/** For admin pages: a 404 for everyone who isn't a platform administrator. */
export async function requirePlatformAdmin(): Promise<AdminContext> {
  const ctx = await getAppContext();
  if (!ctx?.isPlatformAdmin || !isAdminConfigured()) notFound();
  return { ...ctx, db: getSupabaseAdmin() };
}

/** For admin API routes: the context, or an error Response. */
export async function adminGate(): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: Response }> {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false, response: Response.json({ error: "Please sign in again." }, { status: 401 }) };
  if (!ctx.isPlatformAdmin) return { ok: false, response: Response.json({ error: "Not allowed." }, { status: 403 }) };
  if (!isAdminConfigured()) {
    return { ok: false, response: Response.json({ error: "SUPABASE_SECRET_KEY isn't set on the server." }, { status: 503 }) };
  }
  return { ok: true, ctx: { ...ctx, db: getSupabaseAdmin() } };
}

export class AdminError extends Error {}

const actor = (ctx: AdminContext) => ({ actorId: ctx.user.id, actorEmail: ctx.user.email });

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function setAccountStatus(ctx: AdminContext, userId: string, status: AccountStatus, reason: string | null) {
  if (userId === ctx.user.id && status !== "approved") throw new AdminError("You can't change your own account's status.");
  const { data: before } = await ctx.db.from("platform_accounts").select("status, is_admin").eq("user_id", userId).maybeSingle();
  if (!before) throw new AdminError("Account not found.");
  const { error } = await ctx.db
    .from("platform_accounts")
    .update({
      status,
      status_reason: reason?.slice(0, 500) || null,
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
      // A suspended or rejected admin loses admin rights
      ...(status !== "approved" ? { is_admin: false } : {}),
    })
    .eq("user_id", userId);
  if (error) throw new AdminError(error.message);

  await audit({ ...actor(ctx), action: `account.${status}`, targetType: "user", targetId: userId, details: { from: before.status, reason } });

  // Tell the person (email + bell) about approvals, rejections and suspensions
  const decision = status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "suspended" ? "suspended" : null;
  if (decision && before.status !== status) {
    const { data: profile } = await ctx.db.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (profile) {
      await sendEmail(
        accountDecisionEmail({
          to: profile.email,
          decision,
          reason,
          url: decision === "approved" ? `${serverOrigin()}${routes.ask}` : `${serverOrigin()}/contact`,
        }),
      );
    }
    if (decision === "approved") {
      await notifyInApp([{ userId, kind: "success", title: "Welcome to Baba", body: "Your account was approved.", link: routes.ask }]);
    }
  }
}

export async function setPlatformAdmin(ctx: AdminContext, userId: string, isAdmin: boolean) {
  if (userId === ctx.user.id && !isAdmin) throw new AdminError("You can't remove your own admin rights here (use npm run admin:bootstrap -- --remove).");
  const { data: account } = await ctx.db.from("platform_accounts").select("status").eq("user_id", userId).maybeSingle();
  if (!account) throw new AdminError("Account not found.");
  if (isAdmin && account.status !== "approved") throw new AdminError("Approve the account before making it an administrator.");
  const { error } = await ctx.db.from("platform_accounts").update({ is_admin: isAdmin }).eq("user_id", userId);
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), action: isAdmin ? "admin.granted" : "admin.revoked", targetType: "user", targetId: userId });
}

export async function sendPasswordReset(ctx: AdminContext, userId: string) {
  const { data: profile } = await ctx.db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!profile) throw new AdminError("Account not found.");
  const { error } = await ctx.db.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${serverOrigin()}${routes.authCallback}?next=${routes.resetPassword}`,
  });
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), action: "account.password_reset_sent", targetType: "user", targetId: userId });
}

export async function deleteAccount(ctx: AdminContext, userId: string) {
  if (userId === ctx.user.id) throw new AdminError("You can't delete your own account here.");
  const { data: profile } = await ctx.db.from("profiles").select("email").eq("id", userId).maybeSingle();
  // Workspaces this person owns alone go with them (the database cascades their data)
  const { data: owned } = await ctx.db.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("role", "owner");
  for (const { workspace_id } of owned ?? []) {
    const { count } = await ctx.db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace_id);
    if ((count ?? 0) <= 1) await ctx.db.from("workspaces").delete().eq("id", workspace_id);
  }
  const { error } = await ctx.db.auth.admin.deleteUser(userId);
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), action: "account.deleted", targetType: "user", targetId: userId, details: { email: profile?.email } });
}

// ---------------------------------------------------------------------------
// Workspaces (organisations): plan and limits
// ---------------------------------------------------------------------------

export type LimitsInput = {
  planId: string | null;
  monthlyLimitUsd: number | null;
  dailyLimitUsd: number | null;
  allowedAgents: string[] | null;
  note: string | null;
};

export async function setWorkspaceLimits(ctx: AdminContext, workspaceId: string, input: LimitsInput) {
  const { data: ws } = await ctx.db.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle();
  if (!ws) throw new AdminError("Workspace not found.");
  const { error } = await ctx.db.from("workspace_limits").upsert({
    workspace_id: workspaceId,
    plan_id: input.planId,
    monthly_limit_usd: input.monthlyLimitUsd,
    daily_limit_usd: input.dailyLimitUsd,
    allowed_agents: input.allowedAgents,
    note: input.note?.slice(0, 500) || null,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), workspaceId, action: "workspace.limits_updated", targetType: "workspace", targetId: workspaceId, details: input });
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanInput = {
  id?: string;
  key: string;
  name: string;
  description: string;
  priceLabel: string;
  stripePriceId: string | null;
  monthlyLimitUsd: number;
  dailyLimitUsd: number | null;
  taskCapUsd: number;
  maxWorkflows: number | null;
  maxIntegrations: number | null;
  maxPreviews: number | null;
  allowedAgents: string[] | null;
  features: string[];
  isPublic: boolean;
  active: boolean;
  sort: number;
};

export async function savePlan(ctx: AdminContext, input: PlanInput) {
  const row = {
    key: input.key,
    name: input.name,
    description: input.description,
    price_label: input.priceLabel,
    stripe_price_id: input.stripePriceId,
    monthly_limit_usd: input.monthlyLimitUsd,
    daily_limit_usd: input.dailyLimitUsd,
    task_cap_usd: input.taskCapUsd,
    max_workflows: input.maxWorkflows,
    max_integrations: input.maxIntegrations,
    max_previews: input.maxPreviews,
    allowed_agents: input.allowedAgents,
    features: input.features,
    is_public: input.isPublic,
    active: input.active,
    sort: input.sort,
  };
  const { data, error } = input.id
    ? await ctx.db.from("subscription_plans").update(row).eq("id", input.id).select("id").single()
    : await ctx.db.from("subscription_plans").insert(row).select("id").single();
  if (error) throw new AdminError(error.code === "23505" ? "A plan with that key already exists." : error.message);
  await audit({ ...actor(ctx), action: input.id ? "plan.updated" : "plan.created", targetType: "plan", targetId: data.id, details: row });
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

export type SettingsInput = {
  requireApproval: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string | null;
  defaultMonthlyLimitUsd: number;
  defaultTaskCapUsd: number;
  externalModels: ExternalModel[];
};

export async function saveSettings(ctx: AdminContext, input: SettingsInput) {
  const patch: TablesUpdate<"platform_settings"> = {
    require_approval: input.requireApproval,
    maintenance_mode: input.maintenanceMode,
    maintenance_message: input.maintenanceMessage.slice(0, 500) || "Baba is down for maintenance.",
    announcement: input.announcement?.slice(0, 500) || null,
    default_monthly_limit_usd: input.defaultMonthlyLimitUsd,
    default_task_cap_usd: input.defaultTaskCapUsd,
    external_models: input.externalModels as unknown as Json,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await ctx.db.from("platform_settings").update(patch).eq("id", 1);
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), action: "settings.updated", targetType: "platform", details: patch });
}

// ---------------------------------------------------------------------------
// Agents: switching a specialist off removes it from Baba's team on Claude itself
// ---------------------------------------------------------------------------

export async function setAgentEnabled(ctx: AdminContext, key: string, enabled: boolean) {
  const { data: agent } = await ctx.db.from("agent_registry").select("key, category").eq("key", key).maybeSingle();
  if (!agent) throw new AdminError("Agent not found.");
  if (agent.category === "orchestrator") throw new AdminError("Baba itself can't be switched off here. Use maintenance mode instead.");
  const { error } = await ctx.db
    .from("agent_registry")
    .update({ enabled, updated_by: ctx.user.id, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new AdminError(error.message);
  const roster = await applyAgentRoster(ctx);
  await audit({ ...actor(ctx), action: enabled ? "agent.enabled" : "agent.disabled", targetType: "agent", targetId: key, details: { roster } });
}

/**
 * Rewrites Baba's team on Claude to the enabled specialists. New conversations use it
 * straight away; older conversations keep the team they started with.
 */
export async function applyAgentRoster(ctx: AdminContext) {
  const { agentId } = babaConfig();
  if (!agentId || !process.env.ANTHROPIC_API_KEY) throw new AdminError("Baba isn't set up on this server (run npm run baba:setup).");
  const { data: rows } = await ctx.db
    .from("agent_registry")
    .select("key, claude_agent_id, enabled, category, sort")
    .eq("category", "specialist")
    .order("sort");
  const enabled = (rows ?? []).filter((r) => r.enabled && r.claude_agent_id);
  await getClaude().beta.agents.update(agentId, {
    multiagent: {
      type: "multiagent_20261001",
      subagents: {
        type: "enabled",
        predefined_agents: [...enabled.map((r) => r.claude_agent_id!), { type: "self" }],
        inline_agents: { type: "disabled" },
      },
      workflows: { type: "disabled" },
    },
  } as Parameters<ReturnType<typeof getClaude>["beta"]["agents"]["update"]>[1]);
  return enabled.map((r) => r.key);
}

// ---------------------------------------------------------------------------
// Models: the admin picks each agent's model; it's applied to the agent on Claude straight away
// ---------------------------------------------------------------------------

export const ADMIN_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;
export const ADMIN_EFFORTS = ["low", "medium", "high"] as const;

export async function setAgentModel(ctx: AdminContext, key: string, model: string | null, effort: string | null) {
  if (model !== null && !(ADMIN_MODELS as readonly string[]).includes(model)) throw new AdminError("Unknown model.");
  if (effort !== null && !(ADMIN_EFFORTS as readonly string[]).includes(effort)) throw new AdminError("Unknown effort level.");
  const { data: agent } = await ctx.db.from("agent_registry").select("key, name, claude_agent_id").eq("key", key).maybeSingle();
  if (!agent?.claude_agent_id) throw new AdminError("Agent not found (run npm run baba:setup first).");
  if (model) {
    await getClaude().beta.agents.update(agent.claude_agent_id, {
      model: { id: model, effort: (effort ?? "medium") as "medium" },
    } as Parameters<ReturnType<typeof getClaude>["beta"]["agents"]["update"]>[1]);
  }
  const { error } = await ctx.db
    .from("agent_registry")
    .update({ model, effort: model ? (effort ?? "medium") : null, updated_by: ctx.user.id, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new AdminError(error.message);
  await audit({ ...actor(ctx), action: "agent.model_changed", targetType: "agent", targetId: key, details: { model, effort } });
}
