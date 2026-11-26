import "server-only";
import { cache } from "react";
import type { getSupabaseServer } from "@/lib/supabase/server";
import type { Enums, Json } from "@/types/database";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Platform-level account state (PRD §3.1–3.2): every user is PENDING_APPROVAL, APPROVED,
 * REJECTED, SUSPENDED or DEACTIVATED, and a few are platform (master) administrators.
 *
 * The database enforces this on its own: every table's Row Level Security requires an
 * approved account, so these helpers are only for choosing what screen to show.
 */

export type AccountStatus = Enums<"account_status">;
type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;

export type Account = {
  userId: string;
  email: string;
  status: AccountStatus;
  isAdmin: boolean;
  reason: string | null;
};

/** The signed-in person's own account status (they can always read their own row). */
export const getAccount = cache(async (supabase: Supabase): Promise<Account | null> => {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("platform_accounts")
    .select("status, is_admin, status_reason")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    userId,
    email: String(claims.claims.email ?? ""),
    // No row = signed up before accounts existed and wasn't migrated: treat as pending
    status: data?.status ?? "pending_approval",
    isAdmin: Boolean(data?.is_admin && data.status === "approved"),
    reason: data?.status_reason ?? null,
  };
});

export type PlatformSettings = {
  requireApproval: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcement: string | null;
  defaultMonthlyLimitUsd: number;
  defaultTaskCapUsd: number;
};

/** Platform-wide settings (readable by any approved, signed-in user). */
export const getPlatformSettings = cache(async (supabase: Supabase): Promise<PlatformSettings | null> => {
  const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return null;
  return {
    requireApproval: data.require_approval,
    maintenanceMode: data.maintenance_mode,
    maintenanceMessage: data.maintenance_message,
    announcement: data.announcement,
    defaultMonthlyLimitUsd: Number(data.default_monthly_limit_usd),
    defaultTaskCapUsd: Number(data.default_task_cap_usd),
  };
});

export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending_approval: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

// ---------------------------------------------------------------------------
// Audit log (append-only table; written with the server key)
// ---------------------------------------------------------------------------

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  workspaceId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
};

/** Records an event. Never throws: a logging problem must not break the action itself. */
export async function audit(entry: AuditEntry) {
  if (!isAdminConfigured()) {
    console.log("[audit]", entry.action, entry.targetType ?? "", entry.targetId ?? "");
    return;
  }
  const { error } = await getSupabaseAdmin()
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      workspace_id: entry.workspaceId ?? null,
      action: entry.action.slice(0, 80),
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      details: (entry.details ?? {}) as Json,
    });
  if (error) console.error("[audit] couldn't record", entry.action, error.message);
}

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------

export type NewNotification = {
  userId: string;
  workspaceId?: string | null;
  kind?: "info" | "success" | "warning" | "danger";
  title: string;
  body?: string;
  link?: string;
};

/** Adds notifications to people's bell menu. Never throws. */
export async function notifyInApp(notes: NewNotification[]) {
  if (notes.length === 0 || !isAdminConfigured()) return;
  const { error } = await getSupabaseAdmin()
    .from("notifications")
    .insert(
      notes.map((n) => ({
        user_id: n.userId,
        workspace_id: n.workspaceId ?? null,
        kind: n.kind ?? "info",
        title: n.title.slice(0, 200),
        body: (n.body ?? "").slice(0, 2000),
        link: n.link && /^\/[^/]/.test(n.link) ? n.link : null,
      })),
    );
  if (error) console.error("[notifications]", error.message);
}

/** The ids and emails of every platform administrator. */
export async function platformAdmins() {
  if (!isAdminConfigured()) return [];
  const db = getSupabaseAdmin();
  const { data: admins } = await db.from("platform_accounts").select("user_id").eq("is_admin", true).eq("status", "approved");
  const ids = (admins ?? []).map((a) => a.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await db.from("profiles").select("id, email").in("id", ids);
  return (profiles ?? []).map((p) => ({ id: p.id, email: p.email }));
}
