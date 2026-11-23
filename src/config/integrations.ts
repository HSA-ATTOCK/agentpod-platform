/**
 * Tools Baba will be able to use. Connecting them arrives with the integrations
 * phase. Google (Gmail, Drive, Sheets, Calendar) works now; the rest are coming soon.
 */

export type IntegrationCategory = "email" | "communication" | "files" | "crm" | "productivity" | "developer";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  comingSoon?: boolean;
  /** Which connection powers it (one Google sign-in covers Gmail, Drive, Sheets and Calendar). */
  provider?: "google";
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

export const integrationCatalog: Integration[] = [
  { id: "gmail", name: "Gmail", category: "email", provider: "google", description: "Read and search email, summarise threads, prepare drafts, and send with your approval.", canDo: ["Read and search your emails", "Summarise threads", "Save reply drafts in Gmail"], needsApproval: ["Sending any email"] },
  { id: "outlook", name: "Outlook", category: "email", description: "Read work email, summarise attachments and prepare drafts.", comingSoon: true, ...emailPerms },
  { id: "gcal", name: "Google Calendar", category: "productivity", provider: "google", description: "Check availability, propose meeting times and create events with your approval.", canDo: ["See your calendar", "Find free slots"], needsApproval: ["Creating events", "Inviting people"] },
  { id: "gdrive", name: "Google Drive", category: "files", provider: "google", description: "Search and read your files, and save reports Baba makes.", canDo: ["Search and read Docs, Sheets, Slides and text files", "Save new files Baba creates"], needsApproval: ["Editing or deleting existing files (Baba can't do this)"] },
  { id: "gsheets", name: "Google Sheets", category: "files", provider: "google", description: "Read spreadsheets for analysis and reports.", canDo: ["Read your spreadsheets (via Drive)", "Analyse them and build reports"], needsApproval: ["Changing your sheets (Baba can't do this)"] },
  { id: "slack", name: "Slack", category: "communication", description: "Summarise channels and draft updates for your team.", comingSoon: true, ...chatPerms },
  { id: "teams", name: "Microsoft Teams", category: "communication", description: "Summarise chats and draft team updates.", comingSoon: true, ...chatPerms },
  { id: "stripe", name: "Stripe", category: "productivity", description: "Read payments and subscriptions for finance reports.", comingSoon: true, canDo: ["Read payments and invoices", "Calculate revenue and churn", "Build finance reports"], needsApproval: ["Refunds or charges", "Changing subscriptions"] },
  { id: "github", name: "GitHub", category: "developer", description: "Read repositories and pull requests and draft release notes.", comingSoon: true, canDo: ["Read code and pull requests", "Summarise changes", "Draft release notes"], needsApproval: ["Pushing code", "Merging or closing pull requests"] },
  { id: "webhooks", name: "Webhooks", category: "developer", description: "Start Baba tasks from other apps and send results back.", comingSoon: true, canDo: ["Receive events from your apps", "Start a task from an event", "Send results to a URL you choose"], needsApproval: ["Calling a new URL for the first time"] },
  { id: "hubspot", name: "HubSpot", category: "crm", description: "Update contacts and deals with research notes.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "salesforce", name: "Salesforce", category: "crm", description: "Review pipeline and enrich accounts.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "notion", name: "Notion", category: "productivity", description: "Read your knowledge base and publish briefs.", comingSoon: true, canDo: [], needsApproval: [] },
  { id: "shopify", name: "Shopify", category: "productivity", description: "Read orders and inventory and draft product listings.", comingSoon: true, canDo: [], needsApproval: [] },
];
