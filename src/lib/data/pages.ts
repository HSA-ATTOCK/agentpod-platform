import "server-only";
import { fileDownloadUrl } from "@/lib/baba/client";
import type {
  FileRecord,
  InviteRecord,
  MemberRecord,
  ModelInfo,
  ProfileRecord,
  TaskRecord,
  TaskStep,
  WorkflowRecord,
  WorkspaceSettings,
} from "@/types/app-data";
import type { AppContext } from "./context";

/**
 * Server-side loaders for the app pages. They all read through the signed-in
 * user's Supabase client, so Row Level Security limits them to this workspace.
 */

function fail(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`);
}

/** Start of the current month (UTC) as ISO. */
export function monthStart() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Current time in ms (kept out of components so renders stay pure). */
export function requestTime() {
  return Date.now();
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function modelInfo(): ModelInfo {
  const testMode = process.env.BABA_PROFILE === "test";
  return { label: testMode ? "Claude Haiku 5.5" : "Claude Sonnet 5.5", testMode };
}

type FileRow = {
  id: string;
  claude_file_id: string;
  name: string;
  kind: string;
  size_bytes: number;
  created_at: string;
  conversation_id: string | null;
};

function toFile(row: FileRow, conversationTitle: string | null = null): FileRecord {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as FileRecord["kind"],
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    conversationId: row.conversation_id,
    conversationTitle,
    downloadUrl: row.conversation_id ? fileDownloadUrl(row.claude_file_id, row.conversation_id) : null,
  };
}

const FILE_COLUMNS = "id, claude_file_id, name, kind, size_bytes, created_at, conversation_id";

/** Tasks from the last `days` days, newest first (Activity page and dashboard). */
export async function listTasks(ctx: AppContext, { days = 90, limit = 500 } = {}): Promise<TaskRecord[]> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select(
      `id, request, status, agents, error, cost_cents, cap_cents, started_at, finished_at, conversation_id, steps, files (${FILE_COLUMNS})`,
    )
    .eq("workspace_id", ctx.workspace.id)
    .gte("started_at", daysAgo(days))
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) fail("activity", error);

  return data.map((t) => ({
    id: t.id,
    request: t.request,
    status: t.status,
    agents: t.agents,
    error: t.error,
    costCents: t.cost_cents,
    capCents: t.cap_cents,
    startedAt: t.started_at,
    finishedAt: t.finished_at,
    conversationId: t.conversation_id,
    steps: Array.isArray(t.steps) ? (t.steps as unknown as TaskStep[]) : [],
    files: t.files.map((f) => toFile(f)),
  }));
}

/** Every file Baba created in this workspace (Projects page). */
export async function listFiles(ctx: AppContext): Promise<FileRecord[]> {
  const { data, error } = await ctx.supabase
    .from("files")
    .select(`${FILE_COLUMNS}, conversations (title)`)
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) fail("files", error);
  return data.map((f) => toFile(f, f.conversations?.title ?? null));
}

export async function listWorkflows(ctx: AppContext): Promise<WorkflowRecord[]> {
  const { data, error } = await ctx.supabase
    .from("workflows")
    .select(
      "id, name, instruction, frequency, day_of_week, time_of_day, cap_usd, enabled, created_by, webhook_token_hash, tasks (status, started_at, cost_cents, error, conversation_id)",
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .order("started_at", { referencedTable: "tasks", ascending: false })
    .limit(10, { referencedTable: "tasks" });
  if (error) fail("workflows", error);

  return data.map((w) => ({
    id: w.id,
    name: w.name,
    instruction: w.instruction,
    frequency: w.frequency as WorkflowRecord["frequency"],
    dayOfWeek: w.day_of_week,
    timeOfDay: w.time_of_day,
    capUsd: Number(w.cap_usd),
    enabled: w.enabled,
    createdBy: w.created_by,
    hasWebhook: Boolean(w.webhook_token_hash),
    runs: w.tasks.map((t) => ({
      status: t.status,
      startedAt: t.started_at,
      costCents: t.cost_cents,
      error: t.error,
      conversationId: t.conversation_id,
    })),
  }));
}

export async function listMembers(ctx: AppContext): Promise<MemberRecord[]> {
  const { data: members, error } = await ctx.supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: true });
  if (error) fail("team", error);

  const { data: profiles } = await ctx.supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in(
      "id",
      members.map((m) => m.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => {
    const p = byId.get(m.user_id);
    return {
      userId: m.user_id,
      name: p?.full_name || p?.email || "Unknown",
      email: p?.email ?? "",
      role: m.role,
      joinedAt: m.created_at,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

/** Pending invites (only owners and admins can read these; others get an empty list). */
export async function listInvites(ctx: AppContext): Promise<InviteRecord[]> {
  const { data } = await ctx.supabase
    .from("workspace_invites")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
  }));
}

/** Invites other workspaces sent to this user's email. */
export async function listMyInvites(ctx: AppContext) {
  const { data } = await ctx.supabase.rpc("my_invites");
  return (data ?? []).map((i) => ({ id: i.id, workspaceName: i.workspace_name, role: i.role }));
}

export async function getWorkspaceSettings(ctx: AppContext): Promise<WorkspaceSettings> {
  const { data, error } = await ctx.supabase
    .from("workspaces")
    .select("id, name, industry, company_size, timezone, task_cap_usd, monthly_limit_usd, business_context, logo_url")
    .eq("id", ctx.workspace.id)
    .single();
  if (error) fail("workspace settings", error);
  return {
    id: data.id,
    name: data.name,
    industry: data.industry,
    companySize: data.company_size,
    timezone: data.timezone,
    taskCapUsd: Number(data.task_cap_usd),
    monthlyLimitUsd: Number(data.monthly_limit_usd),
    businessContext: data.business_context,
    logoUrl: data.logo_url,
  };
}

export async function getProfile(ctx: AppContext): Promise<ProfileRecord> {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, email, full_name, job_title, phone, language, timezone, created_at, avatar_url")
    .eq("id", ctx.user.id)
    .single();
  if (error) fail("profile", error);
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    jobTitle: data.job_title,
    phone: data.phone,
    language: data.language,
    timezone: data.timezone,
    createdAt: data.created_at,
    avatarUrl: data.avatar_url,
  };
}

/** Sum of task costs since the start of this month (cents). */
export function spendSince(tasks: TaskRecord[], sinceIso: string) {
  return tasks.filter((t) => t.startedAt >= sinceIso).reduce((sum, t) => sum + t.costCents, 0);
}
