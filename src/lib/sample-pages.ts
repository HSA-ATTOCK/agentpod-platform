// SAMPLE DATA for the Agents, Workflows, Integrations, Projects, Activity,
// Settings and Profile pages. Phase 1 only — replaced by real data later.
import {
  Bot,
  Calculator,
  ChartColumn,
  CircleCheck,
  Globe,
  LayoutTemplate,
  PenLine,
  Search,
  Smartphone,
  Target,
  Workflow,
  type LucideIcon,
} from "lucide-react";

// ---------- Agents ----------

export type TeamAgent = {
  id: string;
  name: string;
  job: string;
  model: string;
  status: "active" | "coming_soon";
  tasksThisMonth?: number;
  instructions?: string;
  icon: LucideIcon;
};

export const sampleMainAgent = {
  name: "Baba",
  description:
    "Understands each request, plans the work, hands parts to specialists, checks their results and asks for approval before sensitive actions.",
  model: "Claude Sonnet 5.5",
  tasksThisMonth: 48,
  averageCost: "$0.14",
  instructions:
    "You are Baba, an AI assistant that gets real work done for businesses. Do simple tasks yourself, delegate larger ones to specialists, check their work, and never take a sensitive action without approval.",
  icon: Bot,
};

export const sampleTeam: TeamAgent[] = [
  {
    id: "research_analyst",
    name: "Research Analyst",
    job: "Researches markets, competitors and any topic on the web, with a source for every fact.",
    model: "Claude Sonnet 5.5",
    status: "active",
    tasksThisMonth: 21,
    instructions:
      "Answer exactly the question you are given. Confirm prices and facts on official pages, and give a source link for every claim.",
    icon: Search,
  },
  {
    id: "writer",
    name: "Writer",
    job: "Writes reports, proposals, emails and presentations as Word, PDF and PowerPoint files.",
    model: "Claude Sonnet 5.5",
    status: "active",
    tasksThisMonth: 14,
    instructions:
      "Write clear, professional documents for business readers. Use only the facts you are given and keep their source links.",
    icon: PenLine,
  },
  {
    id: "data_analyst",
    name: "Data Analyst",
    job: "Analyses spreadsheets and data, builds tables and charts, and finds trends and problems.",
    model: "Claude Sonnet 5.5",
    status: "active",
    tasksThisMonth: 6,
    instructions: "Use Python to analyse data accurately. Check your numbers and explain any assumptions.",
    icon: ChartColumn,
  },
  { id: "website_builder", name: "Website Builder", job: "Builds complete, responsive websites you can preview and download.", model: "—", status: "coming_soon", icon: Globe },
  { id: "mobile_app_builder", name: "Mobile App Builder", job: "Builds iOS and Android apps with a live preview.", model: "—", status: "coming_soon", icon: Smartphone },
  { id: "designer", name: "UI/UX Designer", job: "Plans the look, layout and wording of websites and apps.", model: "—", status: "coming_soon", icon: LayoutTemplate },
  { id: "qa_reviewer", name: "QA Reviewer", job: "Tests what the builders made and sends bugs back to them.", model: "—", status: "coming_soon", icon: CircleCheck },
  { id: "marketing", name: "Marketing Strategist", job: "Plans campaigns, content, SEO and social posts.", model: "—", status: "coming_soon", icon: Target },
  { id: "finance", name: "Finance & Accounts Analyst", job: "Bookkeeping, financial reports, budgets and forecasts.", model: "—", status: "coming_soon", icon: Calculator },
  { id: "operations", name: "Operations Agent", job: "Inbox, CRM, scheduling and admin work through your connected tools.", model: "—", status: "coming_soon", icon: Workflow },
];

// ---------- Workflows ----------

export type RunStatus = "succeeded" | "failed" | "running" | "paused";

export type SampleWorkflow = {
  id: string;
  name: string;
  instruction: string;
  schedule: string;
  lastRun: { label: string; status: RunStatus; reason?: string } | null;
  nextRun: string;
  averageCost: string | null;
  enabled: boolean;
};

export const sampleWorkflowList: SampleWorkflow[] = [
  {
    id: "wf1",
    name: "Weekly competitor pricing check",
    instruction: "Check the pricing pages of our top 3 competitors and update the comparison spreadsheet.",
    schedule: "Every Monday at 09:00",
    lastRun: { label: "Today, 09:00", status: "succeeded" },
    nextRun: "Mon, 09:00",
    averageCost: "$0.12",
    enabled: true,
  },
  {
    id: "wf2",
    name: "Monthly sales report",
    instruction: "Summarise last month's closed deals and pipeline into a short report for the team.",
    schedule: "On the 1st of each month",
    lastRun: { label: "Nov 1, 08:05", status: "succeeded" },
    nextRun: "Dec 1, 08:00",
    averageCost: "$0.31",
    enabled: true,
  },
  {
    id: "wf3",
    name: "Daily support inbox summary",
    instruction: "Sort new support emails by urgency and draft replies for the urgent ones.",
    schedule: "Weekdays at 08:30",
    lastRun: { label: "Today, 08:30", status: "failed", reason: "Gmail isn't connected" },
    nextRun: "Tomorrow, 08:30",
    averageCost: "$0.05",
    enabled: true,
  },
  {
    id: "wf4",
    name: "Quarterly market research",
    instruction: "Research market changes and competitor moves this quarter and write a short briefing.",
    schedule: "Manual",
    lastRun: null,
    nextRun: "—",
    averageCost: null,
    enabled: false,
  },
];

// ---------- Integrations ----------

export type IntegrationCategory = "email" | "communication" | "files" | "crm" | "productivity" | "developer";

export type SampleIntegration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  comingSoon?: boolean;
  canDo: string[];
  needsApproval: string[];
};

const emailPerms = {
  canDo: ["Read and search your emails", "Summarise threads", "Draft replies for you to review"],
  needsApproval: ["Sending any email", "Deleting or archiving messages"],
};
const chatPerms = {
  canDo: ["Read channels you choose", "Summarise conversations", "Draft messages"],
  needsApproval: ["Posting any message", "Changing channels or members"],
};
const filePerms = {
  canDo: ["Search and read files you share", "Pull data into reports", "Save files Baba creates"],
  needsApproval: ["Editing or deleting existing files", "Sharing files with others"],
};

export const sampleIntegrations: SampleIntegration[] = [
  { id: "gmail", name: "Gmail", category: "email", description: "Read emails, summarise threads and draft replies for your approval.", ...emailPerms },
  { id: "outlook", name: "Outlook", category: "email", description: "Read work email, summarise attachments and prepare drafts.", ...emailPerms },
  { id: "gcal", name: "Google Calendar", category: "productivity", description: "Check availability and propose meeting times.", canDo: ["See your calendar", "Find free slots", "Draft invitations"], needsApproval: ["Creating or changing events", "Inviting people"] },
  { id: "gdrive", name: "Google Drive", category: "files", description: "Search folders, read documents and save reports.", ...filePerms },
  { id: "gsheets", name: "Google Sheets", category: "files", description: "Read spreadsheets and prepare updates and analysis.", ...filePerms },
  { id: "slack", name: "Slack", category: "communication", description: "Summarise channels and draft updates for your team.", ...chatPerms },
  { id: "teams", name: "Microsoft Teams", category: "communication", description: "Summarise chats and draft team updates.", ...chatPerms },
  { id: "stripe", name: "Stripe", category: "productivity", description: "Read payments and subscriptions for finance reports.", canDo: ["Read payments and invoices", "Calculate revenue and churn", "Build finance reports"], needsApproval: ["Refunds or charges", "Changing subscriptions"] },
  { id: "github", name: "GitHub", category: "developer", description: "Read repositories and pull requests and draft release notes.", canDo: ["Read code and pull requests", "Summarise changes", "Draft release notes"], needsApproval: ["Pushing code", "Merging or closing pull requests"] },
  { id: "webhooks", name: "Webhooks", category: "developer", description: "Start Baba tasks from other apps and send results back.", canDo: ["Receive events from your apps", "Start a task from an event", "Send results to a URL you choose"], needsApproval: ["Calling a new URL for the first time"] },
  { id: "hubspot", name: "HubSpot", category: "crm", description: "Update contacts and deals with research notes.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "salesforce", name: "Salesforce", category: "crm", description: "Review pipeline and enrich accounts.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "notion", name: "Notion", category: "productivity", description: "Read your knowledge base and publish briefs.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "shopify", name: "Shopify", category: "productivity", description: "Read orders and inventory and draft product listings.", comingSoon: true, canDo: [], needsApproval: [] },
];

// ---------- Projects ----------

export type ProjectType = "document" | "spreadsheet" | "presentation" | "website" | "app";

export type SampleProject = {
  id: string;
  name: string;
  type: ProjectType;
  size?: string;
  conversation: string;
  createdAt: string; // ISO date
  comingSoon?: boolean;
};

export const sampleProjects: SampleProject[] = [
  { id: "p1", name: "UK_Online_Bakery_Market_Research.docx", type: "document", size: "37 KB", conversation: "UK online bakery market report", createdAt: "2026-11-22" },
  { id: "p2", name: "Competitor-comparison.xlsx", type: "spreadsheet", size: "24 KB", conversation: "Competitor pricing & sales email", createdAt: "2026-11-21" },
  { id: "p3", name: "Q4 sales summary.pptx", type: "presentation", size: "1.2 MB", conversation: "Q4 pipeline forecast analysis", createdAt: "2026-11-18" },
  { id: "p4", name: "Bakery website", type: "website", conversation: "Build a website for my bakery", createdAt: "2026-11-20", comingSoon: true },
  { id: "p5", name: "Booking app", type: "app", conversation: "Make a booking app for my salon", createdAt: "2026-11-19", comingSoon: true },
];

// ---------- Activity ----------

export type ActivityStep = { title: string; time: string; state: "done" | "failed" | "paused" | "running" };

export type SampleTask = {
  id: string;
  task: string;
  agents: string[];
  status: RunStatus;
  reason?: string;
  started: string;
  duration: string;
  cost: string;
  cap: string;
  files: { name: string; size: string }[];
  steps: ActivityStep[];
};

export const sampleTasks: SampleTask[] = [
  {
    id: "t1", task: "Research the top 3 project management tools and compare their pricing", agents: ["Baba"], status: "succeeded",
    started: "Today, 14:32", duration: "1m 05s", cost: "$0.01", cap: "$1.00", files: [],
    steps: [
      { title: "Searching the web", time: "14:32:04", state: "done" },
      { title: "Reading clickup.com", time: "14:32:31", state: "done" },
      { title: "Reading asana.com", time: "14:32:48", state: "done" },
    ],
  },
  {
    id: "t2", task: "UK online bakery market report (Word document)", agents: ["Baba", "Research Analyst", "Writer"], status: "succeeded",
    started: "Today, 11:20", duration: "6m 42s", cost: "$0.05", cap: "$0.25",
    files: [{ name: "UK_Online_Bakery_Market_Research.docx", size: "37 KB" }],
    steps: [
      { title: "Research Analyst finished its sub-task (market size and trends)", time: "11:22:40", state: "done" },
      { title: "Research Analyst finished its sub-task (competitor pricing)", time: "11:23:15", state: "done" },
      { title: "Writer created UK_Online_Bakery_Market_Research.docx", time: "11:26:50", state: "done" },
    ],
  },
  {
    id: "t3", task: "Summarise this week's support tickets", agents: ["Baba", "Data Analyst"], status: "succeeded",
    started: "Yesterday, 17:05", duration: "1m 35s", cost: "$0.09", cap: "$1.00", files: [{ name: "Support_summary_week47.xlsx", size: "14 KB" }],
    steps: [
      { title: "Data Analyst finished its sub-task", time: "17:06:20", state: "done" },
      { title: "Writing Support_summary_week47.xlsx", time: "17:06:35", state: "done" },
    ],
  },
  {
    id: "t4", task: "Competitor pricing spreadsheet", agents: ["Baba", "Research Analyst", "Data Analyst"], status: "succeeded",
    started: "Yesterday, 14:10", duration: "3m 12s", cost: "$0.24", cap: "$1.00", files: [{ name: "Competitor-comparison.xlsx", size: "24 KB" }],
    steps: [
      { title: "Research Analyst finished its sub-task", time: "14:11:40", state: "done" },
      { title: "Data Analyst finished its sub-task", time: "14:13:10", state: "done" },
    ],
  },
  {
    id: "t5", task: "Send the weekly update email to the sales team", agents: ["Baba", "Writer"], status: "failed", reason: "Gmail isn't connected",
    started: "Nov 21, 09:00", duration: "45s", cost: "$0.04", cap: "$1.00", files: [],
    steps: [
      { title: "Writer finished its sub-task (email draft)", time: "09:00:30", state: "done" },
      { title: "Sending failed: Gmail isn't connected", time: "09:00:45", state: "failed" },
    ],
  },
  {
    id: "t6", task: "Find 200 potential customers in the UK café industry", agents: ["Baba", "Research Analyst"], status: "paused",
    started: "Nov 20, 16:40", duration: "6m 10s", cost: "$1.01", cap: "$1.00", files: [],
    steps: [
      { title: "Research Analyst is working on a sub-task", time: "16:40:30", state: "done" },
      { title: "Paused at the spending cap", time: "16:46:12", state: "paused" },
    ],
  },
  {
    id: "t7", task: "Q4 sales summary presentation", agents: ["Baba", "Writer"], status: "succeeded",
    started: "Nov 18, 10:15", duration: "3m 05s", cost: "$0.22", cap: "$1.00", files: [{ name: "Q4 sales summary.pptx", size: "1.2 MB" }],
    steps: [{ title: "Writer created Q4 sales summary.pptx", time: "10:18:15", state: "done" }],
  },
  {
    id: "t8", task: "Post the daily summary to the #sales Slack channel", agents: ["Baba"], status: "failed", reason: "Slack isn't connected",
    started: "Nov 17, 18:00", duration: "18s", cost: "$0.02", cap: "$1.00", files: [],
    steps: [{ title: "Posting failed: Slack isn't connected", time: "18:00:18", state: "failed" }],
  },
  {
    id: "t9", task: "Draft a security FAQ for new customers", agents: ["Baba", "Writer"], status: "succeeded",
    started: "Nov 16, 12:44", duration: "2m 50s", cost: "$0.19", cap: "$1.00", files: [{ name: "Security_FAQ.docx", size: "32 KB" }],
    steps: [{ title: "Writer created Security_FAQ.docx", time: "12:47:01", state: "done" }],
  },
  {
    id: "t10", task: "Research AI assistant pricing announcements this month", agents: ["Baba", "Research Analyst"], status: "running",
    started: "Just now", duration: "42s so far", cost: "$0.03", cap: "$1.00", files: [],
    steps: [{ title: "Research Analyst is working on a sub-task", time: "14:48:35", state: "running" }],
  },
];

// ---------- Team ----------

export type TeamRole = "Owner" | "Admin" | "Member" | "Viewer";

export const sampleMembers: { name: string; email: string; role: TeamRole; pending?: boolean }[] = [
  { name: "Sarah Connor", email: "sarah@acme.com", role: "Owner" },
  { name: "James Lee", email: "james@acme.com", role: "Admin" },
  { name: "Priya Shah", email: "priya@acme.com", role: "Member" },
  { name: "tom@acme.com", email: "tom@acme.com", role: "Member", pending: true },
];

export const roleDescriptions: Record<TeamRole, string> = {
  Owner: "Everything, including billing, spending limits, integrations and deleting the workspace.",
  Admin: "Invite people, manage agents, workflows and integrations.",
  Member: "Use Ask Baba, run workflows and download files.",
  Viewer: "View activity and files. Can't start tasks.",
};
