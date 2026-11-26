import "server-only";
import { cleanSteps } from "@/lib/workflows/steps";
import { emailEnabled, notificationEvents, type NotificationPrefs } from "@/config/notifications";
import { canManage, type AppContext, type WorkspaceRole } from "@/lib/data/context";
import { getWorkspaceSettings, listFiles, listInvites, listMembers, listTasks, listWorkflows, monthStart } from "@/lib/data/pages";
import { sendEmail } from "@/lib/email/mailer";
import { inviteEmail } from "@/lib/email/templates";
import { deleteConnection } from "@/lib/integrations/connections";
import { disconnectGoogle, listGoogleAccounts, setDefaultGoogle } from "@/lib/integrations/google/oauth";
import { serverOrigin } from "@/lib/origin";
import { nextSlot } from "@/lib/schedule";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { isValidEmail } from "@/lib/validation";
import type { Json, TablesUpdate } from "@/types/database";
import { likeExact } from "@/lib/utils";

/**
 * Baba managing Baba: the app_* tools (defined in baba/app-tools.mjs). They act as the person
 * in the conversation (`ctx`), with that person's role. Changes only run after the person
 * approves the card in the chat. Every query is scoped to the current workspace.
 */

type Input = Record<string, unknown>;
type Result = { text: string; isError: boolean };

const READ_TOOLS = new Set(["app_get_overview", "app_list_workflows", "app_list_tasks", "app_list_files", "app_list_team", "app_get_profile"]);
const WRITE_TOOLS = new Set([
  "app_create_workflow",
  "app_update_workflow",
  "app_delete_workflow",
  "app_update_profile",
  "app_update_workspace",
  "app_update_spending",
  "app_update_notifications",
  "app_invite_member",
  "app_change_member_role",
  "app_remove_member",
  "app_manage_connection",
]);
/** Only owners and admins can make these. */
const MANAGER_TOOLS = new Set([
  "app_update_workspace",
  "app_update_spending",
  "app_invite_member",
  "app_change_member_role",
  "app_remove_member",
  "app_manage_connection",
]);

export const APP_TOOL_NAMES = new Set([...READ_TOOLS, ...WRITE_TOOLS]);
export const appToolNeedsApproval = (name: string) => WRITE_TOOLS.has(name);

const str = (input: Input, key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : undefined);
const num = (input: Input, key: string) => (typeof input[key] === "number" && Number.isFinite(input[key]) ? (input[key] as number) : undefined);
const ok = (text: string): Result => ({ text, isError: false });
const fail = (text: string): Result => ({ text, isError: true });
const money = (usd: number) => `$${usd.toFixed(2)}`;
const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLE: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

export const APP_LABELS: Record<string, string> = {
  app_get_overview: "Checking your workspace",
  app_list_workflows: "Looking at your workflows",
  app_list_tasks: "Looking at recent activity",
  app_list_files: "Looking at your files",
  app_list_team: "Looking at your team",
  app_get_profile: "Looking at your profile",
  app_create_workflow: "Creating a workflow",
  app_update_workflow: "Changing a workflow",
  app_delete_workflow: "Deleting a workflow",
  app_update_profile: "Updating your profile",
  app_update_workspace: "Updating workspace details",
  app_update_spending: "Changing spending limits",
  app_update_notifications: "Changing your notification emails",
  app_invite_member: "Inviting a team member",
  app_change_member_role: "Changing a team member's role",
  app_remove_member: "Removing a team member",
  app_manage_connection: "Changing a connection",
};

function schedule(frequency?: string, day?: number | null, time?: string | null) {
  if (!frequency || frequency === "manual") return "Manual (Run now only)";
  const t = time?.slice(0, 5) ?? "09:00";
  if (frequency === "daily") return `Every day at ${t}`;
  if (frequency === "monthly") return `1st of each month at ${t}`;
  return `Every ${DAYS[day ?? 1]} at ${t}`;
}

/** What the approval card shows for a change. */
export function appApprovalSummary(name: string, input: Input) {
  const lines: string[] = [APP_LABELS[name] ?? name];
  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") lines.push(`${label}: ${String(value).slice(0, 600)}`);
  };
  switch (name) {
    case "app_create_workflow":
    case "app_update_workflow":
      add("Workflow", name === "app_update_workflow" ? str(input, "workflow_id") : undefined);
      add("Name", str(input, "name"));
      if (str(input, "frequency") || str(input, "time") || num(input, "day_of_week") !== undefined) {
        add("Schedule", schedule(str(input, "frequency") ?? "weekly", num(input, "day_of_week"), str(input, "time")));
      }
      add("Cap per run", num(input, "cap_usd") !== undefined ? money(num(input, "cap_usd")!) : undefined);
      add("Instruction", str(input, "instruction"));
      break;
    case "app_update_spending":
      add("Cap per conversation", num(input, "cap_per_conversation_usd") !== undefined ? money(num(input, "cap_per_conversation_usd")!) : undefined);
      add("Monthly limit", num(input, "monthly_limit_usd") !== undefined ? money(num(input, "monthly_limit_usd")!) : undefined);
      break;
    case "app_update_notifications":
      for (const e of notificationEvents) if (typeof input[e.key] === "boolean") add(e.label, input[e.key] ? "email on" : "email off");
      break;
    default:
      for (const [k, v] of Object.entries(input)) add(k.replace(/_/g, " "), typeof v === "object" ? JSON.stringify(v) : v);
  }
  return lines.join("\n");
}

// ---- Reads ----

async function overview(ctx: AppContext) {
  const [settings, members, prefsRow, spend] = await Promise.all([
    getWorkspaceSettings(ctx),
    listMembers(ctx),
    ctx.supabase.from("notification_preferences").select("prefs").eq("user_id", ctx.user.id).eq("workspace_id", ctx.workspace.id).maybeSingle(),
    ctx.supabase.from("tasks").select("cost_cents").eq("workspace_id", ctx.workspace.id).gte("started_at", monthStart()),
  ]);
  const prefs = (prefsRow.data?.prefs ?? {}) as NotificationPrefs;
  const spent = (spend.data ?? []).reduce((sum, t) => sum + t.cost_cents, 0);
  return ok(
    [
      `You: ${ctx.user.fullName} (${ctx.user.email}), role ${ROLE[ctx.workspace.role]}`,
      `Workspace: ${settings.name}`,
      `Industry: ${settings.industry ?? "not set"} · Size: ${settings.companySize ?? "not set"} · Timezone: ${settings.timezone}`,
      `Spending: cap per conversation ${money(settings.taskCapUsd)}, monthly limit ${money(settings.monthlyLimitUsd)}, spent this month ${cents(spent)}`,
      `Team: ${members.length} member(s)`,
      `Your notification emails: ${notificationEvents.map((e) => `${e.label} ${emailEnabled(prefs, e.key) ? "on" : "off"}`).join(", ")}`,
      `Business instructions: ${settings.businessContext ? `"${settings.businessContext.slice(0, 800)}"` : "none yet"}`,
    ].join("\n"),
  );
}

async function workflowsText(ctx: AppContext) {
  const [workflows, settings] = await Promise.all([listWorkflows(ctx), getWorkspaceSettings(ctx)]);
  if (!workflows.length) return ok("No workflows yet.");
  return ok(
    `${workflows.length} workflow(s) (times in ${settings.timezone}):\n` +
      workflows
        .map((w) => {
          const next = w.enabled && w.frequency !== "manual" ? nextSlot(w, settings.timezone, Date.now()) : null;
          const last = w.runs[0];
          return [
            `- id: ${w.id}`,
            `  name: ${w.name}`,
            `  schedule: ${schedule(w.frequency, w.dayOfWeek, w.timeOfDay)}${next ? ` (next ${new Date(next).toISOString()})` : ""}`,
            `  cap per run: ${money(w.capUsd)}`,
            `  last run: ${last ? `${last.status} at ${last.startedAt}, ${cents(last.costCents)}` : "never"}`,
            `  instruction: ${w.instruction.slice(0, 500)}`,
          ].join("\n");
        })
        .join("\n"),
  );
}

async function tasksText(ctx: AppContext, input: Input) {
  const days = Math.min(Math.max(Math.round(num(input, "days") ?? 7), 1), 90);
  const limit = Math.min(Math.max(Math.round(num(input, "limit") ?? 20), 1), 50);
  const status = str(input, "status");
  const tasks = (await listTasks(ctx, { days, limit: 200 })).filter((t) => !status || t.status === status).slice(0, limit);
  if (!tasks.length) return ok(`No tasks in the last ${days} day(s)${status ? ` with status ${status}` : ""}.`);
  return ok(
    tasks
      .map(
        (t) =>
          `- ${t.startedAt} · ${t.status} · ${cents(t.costCents)} · ${t.request.slice(0, 160)}${t.error ? ` · error: ${t.error.slice(0, 160)}` : ""}${t.files.length ? ` · files: ${t.files.map((f) => f.name).join(", ")}` : ""}`,
      )
      .join("\n"),
  );
}

async function filesText(ctx: AppContext, input: Input) {
  const q = str(input, "query")?.toLowerCase();
  const files = (await listFiles(ctx)).filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, 50);
  if (!files.length) return ok("No files found.");
  return ok(files.map((f) => `- ${f.name} (${f.kind}, ${Math.round(f.sizeBytes / 1024)} KB, ${f.createdAt})${f.conversationTitle ? ` from "${f.conversationTitle}"` : ""}`).join("\n") + "\n(Files can be downloaded from the Projects page.)");
}

async function teamText(ctx: AppContext) {
  const [members, invites] = await Promise.all([listMembers(ctx), listInvites(ctx)]);
  return ok(
    `Members:\n${members.map((m) => `- ${m.name} <${m.email}> — ${ROLE[m.role]}${m.userId === ctx.user.id ? " (you)" : ""}`).join("\n")}` +
      (invites.length ? `\nPending invites:\n${invites.map((i) => `- ${i.email} — ${ROLE[i.role]}`).join("\n")}` : "\nNo pending invites."),
  );
}

async function profileText(ctx: AppContext) {
  const { data } = await ctx.supabase.from("profiles").select("full_name, email, job_title, phone, language, timezone").eq("id", ctx.user.id).single();
  if (!data) return fail("Couldn't load your profile.");
  return ok(`Name: ${data.full_name}\nEmail: ${data.email}\nJob title: ${data.job_title ?? "—"}\nPhone: ${data.phone ?? "—"}\nLanguage: ${data.language}\nTimezone: ${data.timezone}`);
}

// ---- Changes ----

function validTime(time?: string) {
  return !time || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function validZone(zone?: string) {
  if (!zone) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

async function createWorkflow(ctx: AppContext, input: Input) {
  const name = str(input, "name");
  const instruction = str(input, "instruction");
  const frequency = str(input, "frequency") ?? "manual";
  const time = str(input, "time") ?? "09:00";
  if (!name || !instruction) return fail("A workflow needs a name and an instruction.");
  if (!validTime(time)) return fail("Time must be HH:MM (24-hour).");
  const { data, error } = await ctx.supabase
    .from("workflows")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      name: name.slice(0, 120),
      instruction,
      frequency,
      day_of_week: frequency === "weekly" ? (num(input, "day_of_week") ?? 1) : null,
      time_of_day: frequency === "manual" ? null : time,
      cap_usd: num(input, "cap_usd") ?? 1,
      steps: cleanSteps(input.steps),
      enabled: frequency !== "manual",
      last_run_slot: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return fail(`Couldn't create the workflow: ${error.message}`);
  return ok(`Workflow "${name}" created (id ${data.id}). ${schedule(frequency, num(input, "day_of_week"), time)}.`);
}

async function updateWorkflow(ctx: AppContext, input: Input) {
  const id = str(input, "workflow_id");
  if (!id) return fail("Missing workflow_id.");
  const { data: current } = await ctx.supabase.from("workflows").select("id, created_by, frequency, time_of_day, day_of_week").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!current) return fail("That workflow wasn't found in this workspace.");
  if (!canManage(ctx.workspace.role) && current.created_by !== ctx.user.id) return fail("Only the workflow's creator or an owner/admin can change it.");
  const time = str(input, "time");
  if (!validTime(time)) return fail("Time must be HH:MM (24-hour).");
  const frequency = str(input, "frequency") ?? current.frequency;
  const patch: TablesUpdate<"workflows"> & Record<string, unknown> = { last_run_slot: new Date().toISOString() };
  if (str(input, "name")) patch.name = str(input, "name")!.slice(0, 120);
  if (str(input, "instruction")) patch.instruction = str(input, "instruction");
  if (str(input, "frequency")) {
    patch.frequency = frequency;
    patch.enabled = frequency !== "manual";
  }
  if (frequency === "manual") patch.time_of_day = null;
  else if (time) patch.time_of_day = time;
  else if (!current.time_of_day) patch.time_of_day = "09:00";
  if (frequency === "weekly") patch.day_of_week = num(input, "day_of_week") ?? current.day_of_week ?? 1;
  else patch.day_of_week = null;
  if (num(input, "cap_usd") !== undefined) patch.cap_usd = num(input, "cap_usd");
  if (Array.isArray(input.steps)) patch.steps = cleanSteps(input.steps);
  const { error } = await ctx.supabase.from("workflows").update(patch as TablesUpdate<"workflows">).eq("id", id).eq("workspace_id", ctx.workspace.id);
  if (error) return fail(`Couldn't change the workflow: ${error.message}`);
  return ok("Workflow updated.");
}

async function deleteWorkflow(ctx: AppContext, input: Input) {
  const id = str(input, "workflow_id");
  const { data: current } = await ctx.supabase.from("workflows").select("id, name, created_by").eq("id", id ?? "").eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!current) return fail("That workflow wasn't found in this workspace.");
  if (!canManage(ctx.workspace.role) && current.created_by !== ctx.user.id) return fail("Only the workflow's creator or an owner/admin can delete it.");
  const { error } = await ctx.supabase.from("workflows").delete().eq("id", current.id);
  if (error) return fail(`Couldn't delete the workflow: ${error.message}`);
  return ok(`Workflow "${current.name}" deleted.`);
}

async function updateProfile(ctx: AppContext, input: Input) {
  const patch: TablesUpdate<"profiles"> & Record<string, unknown> = {};
  if (str(input, "full_name")) patch.full_name = str(input, "full_name")!.slice(0, 120);
  for (const key of ["job_title", "phone"] as const) if (str(input, key) !== undefined) patch[key] = str(input, key) || null;
  if (str(input, "language")) patch.language = str(input, "language");
  if (str(input, "timezone")) {
    if (!validZone(str(input, "timezone"))) return fail("That timezone isn't valid (use a name like Asia/Karachi).");
    patch.timezone = str(input, "timezone");
  }
  if (!Object.keys(patch).length) return fail("Nothing to change.");
  const { error } = await ctx.supabase.from("profiles").update(patch as TablesUpdate<"profiles">).eq("id", ctx.user.id);
  return error ? fail(`Couldn't update your profile: ${error.message}`) : ok("Profile updated.");
}

async function updateWorkspace(ctx: AppContext, input: Input) {
  const patch: TablesUpdate<"workspaces"> & Record<string, unknown> = {};
  if (str(input, "name")) patch.name = str(input, "name")!.slice(0, 100);
  if (str(input, "industry")) patch.industry = str(input, "industry");
  if (str(input, "company_size")) patch.company_size = str(input, "company_size");
  if (str(input, "timezone")) {
    if (!validZone(str(input, "timezone"))) return fail("That timezone isn't valid (use a name like Asia/Karachi).");
    patch.timezone = str(input, "timezone");
  }
  if (typeof input.business_context === "string") {
    if ((input.business_context as string).length > 4000) return fail("Business instructions can be up to 4000 characters.");
    patch.business_context = (input.business_context as string).trim();
  }
  if (!Object.keys(patch).length) return fail("Nothing to change.");
  const { error } = await ctx.supabase.from("workspaces").update(patch as TablesUpdate<"workspaces">).eq("id", ctx.workspace.id);
  return error ? fail(`Couldn't update the workspace: ${error.message}`) : ok("Workspace updated.");
}

async function updateSpending(ctx: AppContext, input: Input) {
  const settings = await getWorkspaceSettings(ctx);
  const cap = num(input, "cap_per_conversation_usd") ?? settings.taskCapUsd;
  const monthly = num(input, "monthly_limit_usd") ?? settings.monthlyLimitUsd;
  if (cap < 0.01 || cap > 1000) return fail("The cap per conversation must be between $0.01 and $1000.");
  if (monthly < 1 || monthly < cap) return fail("The monthly limit must be at least $1 and at least the cap per conversation.");
  const { error } = await ctx.supabase
    .from("workspaces")
    .update({ task_cap_usd: Math.round(cap * 100) / 100, monthly_limit_usd: Math.round(monthly * 100) / 100 })
    .eq("id", ctx.workspace.id);
  return error ? fail(`Couldn't change spending: ${error.message}`) : ok(`Spending updated: cap per conversation ${money(cap)}, monthly limit ${money(monthly)}.`);
}

async function updateNotifications(ctx: AppContext, input: Input) {
  const { data } = await ctx.supabase.from("notification_preferences").select("prefs").eq("user_id", ctx.user.id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  const prefs = { ...((data?.prefs ?? {}) as Record<string, { email?: boolean }>) };
  let changed = 0;
  for (const e of notificationEvents) {
    if (typeof input[e.key] === "boolean") {
      prefs[e.key] = { email: input[e.key] as boolean };
      changed++;
    }
  }
  if (!changed) return fail("Nothing to change.");
  const { error } = await ctx.supabase
    .from("notification_preferences")
    .upsert({ user_id: ctx.user.id, workspace_id: ctx.workspace.id, prefs: prefs as unknown as Json, updated_at: new Date().toISOString() });
  return error ? fail(`Couldn't save: ${error.message}`) : ok("Notification emails updated.");
}

async function inviteMember(ctx: AppContext, input: Input) {
  const email = str(input, "email")?.toLowerCase();
  const role = str(input, "role") as WorkspaceRole | undefined;
  if (!email || !isValidEmail(email)) return fail("That email address isn't valid.");
  if (!role || !["admin", "member", "viewer"].includes(role)) return fail("Role must be admin, member or viewer.");
  const members = await listMembers(ctx);
  if (members.some((m) => m.email.toLowerCase() === email)) return fail(`${email} is already in this workspace.`);
  const { error } = await ctx.supabase.from("workspace_invites").insert({ workspace_id: ctx.workspace.id, email, role, invited_by: ctx.user.id });
  if (error) return fail(error.code === "23505" ? `There's already a pending invite for ${email}.` : `Couldn't create the invite: ${error.message}`);
  const url = `${serverOrigin()}/sign-up?email=${encodeURIComponent(email)}`;
  const sent = await sendEmail(inviteEmail({ to: email, workspaceName: ctx.workspace.name, inviterName: ctx.user.fullName, role, url }));
  return ok(sent ? `Invited ${email} as ${ROLE[role]}; they've been emailed a sign-up link.` : `Invite created for ${email} as ${ROLE[role]}. Email isn't set up, so share this link with them: ${url}`);
}

async function memberByEmail(ctx: AppContext, email?: string) {
  if (!email) return null;
  return (await listMembers(ctx)).find((m) => m.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function changeRole(ctx: AppContext, input: Input) {
  const role = str(input, "role") as WorkspaceRole | undefined;
  if (!role || !["admin", "member", "viewer"].includes(role)) return fail("Role must be admin, member or viewer.");
  const member = await memberByEmail(ctx, str(input, "email"));
  if (!member) return fail("That person isn't a member of this workspace.");
  if (member.role === "owner") return fail("The owner's role can't be changed here. To hand over ownership use Settings → Team → Make owner.");
  if (member.userId === ctx.user.id) return fail("You can't change your own role.");
  const { error } = await ctx.supabase.from("workspace_members").update({ role }).eq("workspace_id", ctx.workspace.id).eq("user_id", member.userId);
  return error ? fail(`Couldn't change the role: ${error.message}`) : ok(`${member.name} is now ${ROLE[role]}.`);
}

async function removeMember(ctx: AppContext, input: Input) {
  const email = str(input, "email")?.toLowerCase();
  const member = await memberByEmail(ctx, email);
  if (!member) {
    const { data } = await ctx.supabase
      .from("workspace_invites")
      .update({ status: "revoked" })
      .eq("workspace_id", ctx.workspace.id)
      .eq("status", "pending")
      .ilike("email", likeExact(email ?? ""))
      .select("id");
    return data?.length ? ok(`Invite for ${email} cancelled.`) : fail("No member or pending invite with that email.");
  }
  if (member.role === "owner") return fail("The owner can't be removed.");
  if (member.userId === ctx.user.id) return fail("To leave the workspace yourself, use Settings → Team → Leave.");
  const { error } = await ctx.supabase.from("workspace_members").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", member.userId);
  return error ? fail(`Couldn't remove them: ${error.message}`) : ok(`${member.name} was removed from the workspace.`);
}

async function manageConnection(ctx: AppContext, input: Input) {
  if (!isAdminConfigured()) return fail("Connections can't be changed on this server yet.");
  const action = str(input, "action");
  if (action === "remove_api_key") {
    const name = str(input, "service_name")?.toLowerCase();
    const { data } = await getSupabaseAdmin()
      .from("integrations")
      .select("id, label")
      .eq("workspace_id", ctx.workspace.id)
      .eq("provider", "api_key");
    const row = data?.find((r) => r.label.toLowerCase() === name);
    if (!row) return fail("No API key with that service name.");
    await deleteConnection(ctx.workspace.id, row.id);
    return ok(`${row.label} key removed.`);
  }
  const email = str(input, "account_email")?.toLowerCase();
  const account = (await listGoogleAccounts(ctx.workspace.id)).find((a) => a.email.toLowerCase() === email);
  if (!account) return fail("That Google account isn't connected.");
  if (action === "make_default_google") {
    await setDefaultGoogle(ctx.workspace.id, account.id);
    return ok(`${account.email} is now the default Google account.`);
  }
  if (action === "disconnect_google") {
    await disconnectGoogle(ctx.workspace.id, account.id);
    return ok(`${account.email} disconnected.`);
  }
  return fail("Unknown action.");
}

/** Runs an app_* tool as the person in `ctx` (for changes: the person who approved it). */
export async function runAppTool(name: string, input: Input, ctx: AppContext): Promise<Result> {
  try {
    if (WRITE_TOOLS.has(name) && ctx.workspace.role === "viewer") return fail("Viewers can't make changes. Ask an owner or admin.");
    if (MANAGER_TOOLS.has(name) && !canManage(ctx.workspace.role)) return fail("Only owners and admins can do this. Ask one of them.");
    switch (name) {
      case "app_get_overview":
        return await overview(ctx);
      case "app_list_workflows":
        return await workflowsText(ctx);
      case "app_list_tasks":
        return await tasksText(ctx, input);
      case "app_list_files":
        return await filesText(ctx, input);
      case "app_list_team":
        return await teamText(ctx);
      case "app_get_profile":
        return await profileText(ctx);
      case "app_create_workflow":
        return await createWorkflow(ctx, input);
      case "app_update_workflow":
        return await updateWorkflow(ctx, input);
      case "app_delete_workflow":
        return await deleteWorkflow(ctx, input);
      case "app_update_profile":
        return await updateProfile(ctx, input);
      case "app_update_workspace":
        return await updateWorkspace(ctx, input);
      case "app_update_spending":
        return await updateSpending(ctx, input);
      case "app_update_notifications":
        return await updateNotifications(ctx, input);
      case "app_invite_member":
        return await inviteMember(ctx, input);
      case "app_change_member_role":
        return await changeRole(ctx, input);
      case "app_remove_member":
        return await removeMember(ctx, input);
      case "app_manage_connection":
        return await manageConnection(ctx, input);
      default:
        return fail(`Unknown tool "${name}".`);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
