import "server-only";
import { routes } from "@/config/routes";
import type { AppContext } from "@/lib/data/context";
import { sendEmail } from "@/lib/email/mailer";
import { spendAlertEmail } from "@/lib/email/templates";
import { serverOrigin } from "@/lib/origin";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { notifyInApp } from "./account";

/**
 * Warns a workspace's owners and admins (bell + email) when AI spend passes 80% and 100%
 * of the monthly limit. Each warning is sent once per month. Never throws.
 */
export async function checkSpendAlerts(ctx: AppContext) {
  if (!isAdminConfigured()) return;
  try {
    const db = getSupabaseAdmin();
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const month = start.toISOString().slice(0, 7);
    const { data: tasks } = await db.from("tasks").select("cost_cents").eq("workspace_id", ctx.workspace.id).gte("started_at", start.toISOString());
    const spent = (tasks ?? []).reduce((s, t) => s + (t.cost_cents ?? 0), 0);
    const limit = Math.round(ctx.workspace.monthlyLimitUsd * 100);
    if (limit <= 0) return;
    const level = spent >= limit ? 100 : spent >= limit * 0.8 ? 80 : 0;
    if (!level) return;

    const { data: ws } = await db.from("workspaces").select("spend_alert_month, spend_alert_level").eq("id", ctx.workspace.id).single();
    const already = ws?.spend_alert_month === month ? ws.spend_alert_level : 0;
    if (level <= already) return;
    // Claim the alert (only one server sends it)
    const { data: claimed } = await db
      .from("workspaces")
      .update({ spend_alert_month: month, spend_alert_level: level })
      .eq("id", ctx.workspace.id)
      .or(`spend_alert_month.is.null,spend_alert_month.neq.${month},spend_alert_level.lt.${level}`)
      .select("id");
    if (!claimed?.length) return;

    const { data: managers } = await db.from("workspace_members").select("user_id").eq("workspace_id", ctx.workspace.id).in("role", ["owner", "admin"]);
    const ids = (managers ?? []).map((m) => m.user_id);
    const { data: people } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    await notifyInApp(
      ids.map((userId) => ({
        userId,
        workspaceId: ctx.workspace.id,
        kind: level >= 100 ? ("danger" as const) : ("warning" as const),
        title: level >= 100 ? "Monthly spending limit reached" : "80% of the monthly limit used",
        body: `${ctx.workspace.name}: ${money(spent)} of ${money(limit)}`,
        link: routes.usage,
      })),
    );
    await Promise.all(
      (people ?? []).map((p) =>
        sendEmail(
          spendAlertEmail({ to: p.email, workspaceName: ctx.workspace.name, percent: level, spent: money(spent), limit: money(limit), url: `${serverOrigin()}${routes.usage}` }),
        ),
      ),
    );
  } catch (error) {
    console.error("[spend-alerts]", error instanceof Error ? error.message : error);
  }
}
