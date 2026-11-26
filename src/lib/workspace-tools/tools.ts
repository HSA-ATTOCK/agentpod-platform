import "server-only";
import { listCustomAgentsText, runCustomAgent } from "@/lib/custom-agents/custom-agents";
import { routes } from "@/config/routes";
import type { AppContext } from "@/lib/data/context";
import { sendEmail } from "@/lib/email/mailer";
import { babaNoticeEmail } from "@/lib/email/templates";
import { serverOrigin } from "@/lib/origin";
import { notifyInApp } from "@/lib/platform/account";
import { dbQuery } from "@/lib/integrations/databases";
import { deleteMemory, memoryText, saveMemory, searchKnowledge } from "@/lib/knowledge/knowledge";
import { publishProduction, requestCustomDomain } from "@/lib/sites/production";
import { listSitesText, publishSitePreview, restoreSiteVersion } from "@/lib/sites/sites";

/**
 * Server side of baba/workspace-tools.mjs: memory, knowledge base, website previews and
 * read-only databases. Every call runs with the permissions of the person in `ctx`.
 */

type Input = Record<string, unknown>;
type Result = { text: string; isError: boolean };
const str = (input: Input, key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

export const WORKSPACE_TOOL_NAMES = new Set([
  "site_publish_production",
  "site_connect_domain",
  "workflow_checkpoint",
  "notify_me",
  "list_custom_agents",
  "run_custom_agent",
  "memory_list",
  "memory_save",
  "memory_delete",
  "knowledge_search",
  "site_publish_preview",
  "site_list",
  "site_restore_version",
  "request_database_connection",
  "db_query",
]);

/** Changes a person must approve first. */
export const WORKSPACE_NEEDS_APPROVAL = new Set(["memory_delete", "site_restore_version", "workflow_checkpoint", "site_publish_production"]);

/** Actions only contributors (not viewers) may take; managers for site rollbacks. */
const WRITE_TOOLS = new Set(["memory_save", "memory_delete", "site_publish_preview", "site_restore_version", "site_publish_production", "site_connect_domain"]);

export const WORKSPACE_LABELS: Record<string, string> = {
  workflow_checkpoint: "Waiting for your go-ahead",
  notify_me: "Sending you a notification",
  list_custom_agents: "Checking your custom agents",
  run_custom_agent: "Your custom agent is working on a sub-task",
  memory_save: "Saving to business memory",
  memory_delete: "Deleting a memory",
  knowledge_search: "Searching the knowledge base",
  site_publish_preview: "Publishing the website preview",
  site_list: "Listing websites",
  site_publish_production: "Publishing the website live",
  site_connect_domain: "Connecting your domain",
  site_restore_version: "Restoring a website version",
  request_database_connection: "Asking you to connect a database",
  db_query: "Querying your database (read-only)",
};

export function workspaceApprovalSummary(name: string, input: Input) {
  if (name === "site_publish_production") return `Publish site ${str(input, "site_id")} live${input.version ? ` (version ${String(input.version)})` : ""}`;
  if (name === "workflow_checkpoint") return str(input, "summary").slice(0, 2000) || "Continue with the next step";
  if (name === "memory_delete") return `Delete memory entry ${str(input, "id")}`;
  if (name === "site_restore_version") return `Make version ${String(input.version)} the live preview of site ${str(input, "site_id")}`;
  return name;
}

export async function runWorkspaceTool(name: string, input: Input, scope: { ctx: AppContext; sessionId: string; conversationId: string }): Promise<Result> {
  const { ctx } = scope;
  if (WRITE_TOOLS.has(name) && ctx.workspace.role === "viewer") {
    return { text: "The person you're working for is a Viewer in this workspace, so this change isn't allowed.", isError: true };
  }
  try {
    switch (name) {
      case "workflow_checkpoint":
        // Only reached after a person approved it (it always needs approval)
        return { text: "Approved. Continue with the next step.", isError: false };
      case "notify_me": {
        const title = str(input, "title").slice(0, 200) || "Update from Baba";
        const message = str(input, "message").slice(0, 2000);
        const link = `${routes.ask}?c=${scope.conversationId}`;
        await notifyInApp([{ userId: ctx.user.id, workspaceId: ctx.workspace.id, kind: "info", title, body: message, link }]);
        const sent = await sendEmail(babaNoticeEmail({ to: ctx.user.email, title, message, url: `${serverOrigin()}${link}` }));
        return { text: sent ? "Notified (bell menu and email)." : "Notified in the bell menu (email isn't set up on this server).", isError: false };
      }
      case "list_custom_agents":
        return { text: await listCustomAgentsText(ctx), isError: false };
      case "run_custom_agent":
        return { text: await runCustomAgent(ctx, scope, { agent: str(input, "agent"), task: str(input, "task") }), isError: false };
      case "memory_list":
        return { text: await memoryText(ctx), isError: false };
      case "memory_save": {
        const id = await saveMemory(ctx, { category: str(input, "category"), content: str(input, "content"), source: "baba", id: str(input, "id") || undefined });
        return { text: `Saved to memory (id ${id}), marked as your suggestion until the user confirms it on the Memory page.`, isError: false };
      }
      case "memory_delete":
        await deleteMemory(ctx, str(input, "id"));
        return { text: "Deleted.", isError: false };
      case "knowledge_search":
        return { text: await searchKnowledge(ctx, str(input, "query"), Number(input.limit) || 8), isError: false };
      case "site_publish_preview": {
        const result = await publishSitePreview(ctx, scope, {
          zipName: str(input, "zip_file_name"),
          siteName: str(input, "site_name") || undefined,
          siteId: str(input, "site_id") || undefined,
          note: str(input, "note") || undefined,
        });
        return {
          text: `Published "${result.name}" version ${result.version} (${result.files.length} files).\nPreview link: ${result.url}\nsite_id: ${result.siteId}\nShare this link with the user. It works for 30 days; the user can manage versions on the Websites page.`,
          isError: false,
        };
      }
      case "site_publish_production": {
        const live = await publishProduction(ctx, str(input, "site_id"), input.version ? Number(input.version) : undefined);
        return { text: `"${live.name}" version ${live.version} is live at ${live.url}`, isError: false };
      }
      case "site_connect_domain":
        if (ctx.workspace.role !== "owner" && ctx.workspace.role !== "admin") return { text: "Only owners and admins can connect a domain.", isError: true };
        return { text: await requestCustomDomain(ctx, str(input, "site_id"), str(input, "domain")), isError: false };
      case "site_list":
        return { text: await listSitesText(ctx), isError: false };
      case "site_restore_version": {
        if (ctx.workspace.role !== "owner" && ctx.workspace.role !== "admin") {
          return { text: "Only workspace owners and admins can restore a website version.", isError: true };
        }
        await restoreSiteVersion(ctx, str(input, "site_id"), Number(input.version));
        return { text: `Version ${String(input.version)} is now live on the preview link.`, isError: false };
      }
      case "db_query":
        return dbQuery(ctx.workspace.id, input);
      default:
        return { text: `Unknown tool "${name}".`, isError: true };
    }
  } catch (error) {
    return { text: error instanceof Error ? error.message : "That didn't work.", isError: true };
  }
}
