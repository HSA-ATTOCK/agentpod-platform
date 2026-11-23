/**
 * Tools Baba will be able to use. Connecting them arrives with the integrations
 * phase (each needs its own sign-in and permissions), so none can be connected yet.
 */

export type IntegrationCategory = "email" | "communication" | "files" | "crm" | "productivity" | "developer";

export type Integration = {
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

export const integrationCatalog: Integration[] = [
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
