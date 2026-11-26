import {
  AdminError,
  adminGate,
  applyAgentRoster,
  deleteAccount,
  savePlan,
  saveSettings,
  sendPasswordReset,
  setAccountStatus,
  setAgentEnabled,
  setAgentModel,
  setPlatformAdmin,
  setWorkspaceLimits,
} from "@/lib/platform/admin";
import { parseExternalModels } from "@/lib/ai/gateway";
import type { AccountStatus } from "@/lib/platform/account";

/**
 * POST /api/admin — body: { action, ...fields }
 * Every platform-administration change goes through here. adminGate() checks the caller
 * is an approved platform administrator before anything runs, and each change is audited.
 */

type Body = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: AccountStatus[] = ["pending_approval", "approved", "rejected", "suspended", "deactivated"];

function id(body: Body, key: string) {
  const v = body[key];
  if (typeof v !== "string" || !UUID.test(v)) throw new AdminError(`Invalid ${key}.`);
  return v;
}
function text(body: Body, key: string, max: number, required = false) {
  const v = typeof body[key] === "string" ? (body[key] as string).trim() : "";
  if (required && !v) throw new AdminError(`${key} is required.`);
  return v.slice(0, max);
}
function money(body: Body, key: string, nullable: true): number | null;
function money(body: Body, key: string, nullable?: false): number;
function money(body: Body, key: string, nullable = false) {
  const v = body[key];
  if ((v === null || v === "" || v === undefined) && nullable) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw new AdminError(`${key} must be a positive amount.`);
  return Math.round(n * 100) / 100;
}
function count(body: Body, key: string) {
  const v = body[key];
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new AdminError(`${key} must be a whole number.`);
  return n;
}
function list(body: Body, key: string, pattern: RegExp, max = 40) {
  const v = body[key];
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) throw new AdminError(`${key} must be a list.`);
  return v.filter((x): x is string => typeof x === "string" && pattern.test(x)).slice(0, max);
}
const bool = (body: Body, key: string) => body[key] === true;

export async function POST(request: Request) {
  const gate = await adminGate();
  if (!gate.ok) return gate.response;
  const { ctx } = gate;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "account.status": {
        const status = body.status as AccountStatus;
        if (!STATUSES.includes(status)) throw new AdminError("Invalid status.");
        await setAccountStatus(ctx, id(body, "userId"), status, text(body, "reason", 500) || null);
        break;
      }
      case "account.admin":
        await setPlatformAdmin(ctx, id(body, "userId"), bool(body, "isAdmin"));
        break;
      case "account.reset_password":
        await sendPasswordReset(ctx, id(body, "userId"));
        break;
      case "account.delete":
        if (body.confirm !== "DELETE") throw new AdminError("Type DELETE to confirm.");
        await deleteAccount(ctx, id(body, "userId"));
        break;
      case "workspace.limits":
        await setWorkspaceLimits(ctx, id(body, "workspaceId"), {
          planId: body.planId ? id(body, "planId") : null,
          monthlyLimitUsd: money(body, "monthlyLimitUsd", true),
          dailyLimitUsd: money(body, "dailyLimitUsd", true),
          allowedAgents: list(body, "allowedAgents", /^[a-z0-9_]{2,40}$/),
          note: text(body, "note", 500) || null,
        });
        break;
      case "plan.save": {
        const key = text(body, "key", 40, true).toLowerCase();
        if (!/^[a-z0-9_-]{2,40}$/.test(key)) throw new AdminError("The plan key may use a–z, 0–9, - and _.");
        await savePlan(ctx, {
          id: body.id ? id(body, "id") : undefined,
          key,
          name: text(body, "name", 60, true),
          description: text(body, "description", 500),
          priceLabel: text(body, "priceLabel", 60),
          stripePriceId: (() => {
            const v = text(body, "stripePriceId", 100);
            if (v && !/^price_[A-Za-z0-9]+$/.test(v)) throw new AdminError("A Stripe Price ID looks like price_1Abc…");
            return v || null;
          })(),
          monthlyLimitUsd: money(body, "monthlyLimitUsd"),
          dailyLimitUsd: money(body, "dailyLimitUsd", true),
          taskCapUsd: money(body, "taskCapUsd"),
          maxWorkflows: count(body, "maxWorkflows"),
          maxIntegrations: count(body, "maxIntegrations"),
          maxPreviews: count(body, "maxPreviews"),
          allowedAgents: list(body, "allowedAgents", /^[a-z0-9_]{2,40}$/),
          features: list(body, "features", /^.{1,120}$/, 20) ?? [],
          isPublic: bool(body, "isPublic"),
          active: bool(body, "active"),
          sort: count(body, "sort") ?? 0,
        });
        break;
      }
      case "settings.save":
        await saveSettings(ctx, {
          requireApproval: bool(body, "requireApproval"),
          maintenanceMode: bool(body, "maintenanceMode"),
          maintenanceMessage: text(body, "maintenanceMessage", 500),
          announcement: text(body, "announcement", 500) || null,
          defaultMonthlyLimitUsd: money(body, "defaultMonthlyLimitUsd"),
          defaultTaskCapUsd: money(body, "defaultTaskCapUsd"),
          externalModels: (() => {
            const raw = Array.isArray(body.externalModels) ? body.externalModels : [];
            const models = parseExternalModels(raw);
            if (models.length !== raw.length) throw new AdminError("Each outside model needs an ID (a–z, 0–9, -), provider, model name, label and both prices.");
            if (new Set(models.map((m) => m.id)).size !== models.length) throw new AdminError("Model IDs must be unique.");
            for (const m of models) if (m.fallback && !models.some((x) => x.id === m.fallback && x.id !== m.id)) throw new AdminError(`Fallback "${m.fallback}" isn't another model in the list.`);
            return models;
          })(),
        });
        break;
      case "agent.enabled": {
        const key = text(body, "key", 40, true);
        await setAgentEnabled(ctx, key, bool(body, "enabled"));
        break;
      }
      case "agent.model": {
        const key = text(body, "key", 40, true);
        const model = text(body, "model", 40) || null;
        await setAgentModel(ctx, key, model, text(body, "effort", 10) || null);
        break;
      }
      case "agent.sync":
        await applyAgentRoster(ctx);
        break;
      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[admin]", body.action, error);
    return Response.json({ error: "Something went wrong. Check the server log." }, { status: 500 });
  }
}
