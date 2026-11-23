// Tools that let Baba manage Baba itself for the user, from the chat: workflows, profile,
// workspace settings, spending, notifications, team and connections. They run on our server
// with the user's own permissions; every change waits for the user's approval in the chat.

const s = (description) => ({ type: "string", description });
const frequency = { type: "string", enum: ["manual", "daily", "weekly", "monthly"] };
const role = { type: "string", enum: ["admin", "member", "viewer"] };

function tool(name, description, properties = {}, required = []) {
  return { type: "custom", name, description, input_schema: { type: "object", properties, required } };
}

export const appTools = [
  // ---- Read (no approval) ----
  tool("app_get_overview", "Overview of the user's Baba account: their role, the workspace's details and settings (timezone, spending cap per conversation, monthly limit, spend this month, business instructions), notification choices and team size."),
  tool("app_list_workflows", "List the workspace's saved workflows (id, name, instruction, schedule, cap, last runs)."),
  tool(
    "app_list_tasks",
    "List recent tasks from the Activity log (what Baba did, status, cost, errors).",
    {
      days: { type: "integer", minimum: 1, maximum: 90, description: "How far back (default 7)" },
      status: { type: "string", enum: ["running", "succeeded", "failed", "paused", "needs_approval"] },
      limit: { type: "integer", minimum: 1, maximum: 50, description: "Default 20" },
    },
  ),
  tool("app_list_files", "List files Baba has created (the Projects page), newest first.", { query: s("Only files whose name contains this (optional)") }),
  tool("app_list_team", "List the workspace's members (name, email, role) and pending invites."),
  tool("app_get_profile", "The user's own profile: name, email, job title, phone, language, timezone."),

  // ---- Changes (each one waits for the user's approval) ----
  tool(
    "app_create_workflow",
    "Create a saved workflow (a task Baba can run on a schedule or on demand). Times are in the workspace timezone.",
    {
      name: s("Short name"),
      instruction: s("What Baba should do each run, written like a chat request"),
      frequency,
      day_of_week: { type: "integer", minimum: 0, maximum: 6, description: "For weekly: 0 = Sunday … 6 = Saturday" },
      time: s("HH:MM 24-hour, for daily/weekly/monthly"),
      cap_usd: { type: "number", minimum: 0.01, maximum: 1000, description: "Spending cap per run in USD (default 1)" },
    },
    ["name", "instruction", "frequency"],
  ),
  tool(
    "app_update_workflow",
    "Change a saved workflow. Give its id (from app_list_workflows) and only the fields to change.",
    {
      workflow_id: s("Workflow id"),
      name: s("New name"),
      instruction: s("New instruction"),
      frequency,
      day_of_week: { type: "integer", minimum: 0, maximum: 6 },
      time: s("HH:MM 24-hour"),
      cap_usd: { type: "number", minimum: 0.01, maximum: 1000 },
    },
    ["workflow_id"],
  ),
  tool("app_delete_workflow", "Delete a saved workflow (its past runs stay in Activity).", { workflow_id: s("Workflow id") }, ["workflow_id"]),
  tool("app_update_profile", "Update the user's own profile. Give only the fields to change.", {
    full_name: s("Full name"),
    job_title: s("Job title"),
    phone: s("Phone number"),
    language: { type: "string", enum: ["en-GB", "en-US", "ur", "ar"] },
    timezone: s("IANA timezone, e.g. Asia/Karachi"),
  }),
  tool("app_update_workspace", "Update workspace details (owners/admins). Give only the fields to change.", {
    name: s("Workspace name"),
    industry: { type: "string", enum: ["software", "retail", "food", "agency", "finance", "health", "education", "other"] },
    company_size: { type: "string", enum: ["1-10", "11-50", "51-200", "201+"] },
    timezone: s("IANA timezone used for workflow schedules, e.g. Asia/Karachi"),
    business_context: s("'About your business' notes Baba reads at the start of each new conversation (max 4000 characters)"),
  }),
  tool("app_update_spending", "Change spending limits (owners/admins).", {
    cap_per_conversation_usd: { type: "number", minimum: 0.01, maximum: 1000 },
    monthly_limit_usd: { type: "number", minimum: 1 },
  }),
  tool("app_update_notifications", "Turn the user's own notification emails on or off.", {
    task_finished: { type: "boolean" },
    task_failed: { type: "boolean" },
    paused_at_cap: { type: "boolean" },
    approval_needed: { type: "boolean" },
  }),
  tool("app_invite_member", "Invite someone to the workspace by email (owners/admins). They get an email with a sign-up link.", { email: s("Their email"), role }, ["email", "role"]),
  tool("app_change_member_role", "Change a team member's role (owners/admins; the owner's role can't be changed here).", { email: s("Member's email"), role }, ["email", "role"]),
  tool("app_remove_member", "Remove someone from the workspace (owners/admins), or cancel a pending invite for that email.", { email: s("Member's or invitee's email") }, ["email"]),
  tool("app_manage_connection", "Disconnect a Google account, make one the default, or remove an API key (owners/admins).", {
    action: { type: "string", enum: ["disconnect_google", "make_default_google", "remove_api_key"] },
    account_email: s("Google account email (for the Google actions)"),
    service_name: s("Service name (for remove_api_key)"),
  }, ["action"]),
];

export const APP_RULES = `
MANAGING BABA FROM THE CHAT: the user can ask you to do anything they could do on Baba's pages, and you do
it with the app_* tools: look things up (overview, workflows, activity, files, team, profile) and make changes
(workflows, profile, workspace details, business instructions, spending limits, notification emails, inviting
and managing team members, connections).
- Look things up first when you need ids or current values; never guess an id.
- Every change shows the user an approval card; if they reject it, don't retry unless asked.
- Many changes need the owner or admin role; if the user's role can't do it, say who can.
- These stay on their pages for safety; give the link instead: change password or email, two-step
  verification (/profile and /settings → Security), delete account (/profile), delete workspace and transfer
  ownership (/settings → Security / Team).
- After a change, confirm in one line what changed.
`;
