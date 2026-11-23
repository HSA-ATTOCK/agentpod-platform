import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { decrypt, encrypt } from "./crypto";
import { listDatabases } from "./databases";
import { listGoogleAccounts, workspaceGoogleAppId } from "./google/oauth";

/**
 * Connections that aren't OAuth sign-ins: services added with an API key from the
 * secure box in the chat (or the Integrations page). The key is encrypted and only ever
 * used by our server, and only for requests to the host it was added for.
 */

export const API_KEY_PROVIDER = "api_key";

export type ApiKeyConfig = { host: string; header: string; prefix: string; queryParam: string | null };

const HOST = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.supabase\.co)$/i;

export function cleanHost(value: string) {
  const host = value.trim().replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  if (!HOST.test(host) || PRIVATE_HOST.test(host)) return null;
  return host;
}

/** Saves (or replaces) an API key for a service. Returns the connection id. */
export async function saveApiKey(input: {
  workspaceId: string;
  userId: string;
  serviceName: string;
  host: string;
  header?: string;
  prefix?: string;
  queryParam?: string | null;
  key: string;
}) {
  const host = cleanHost(input.host);
  if (!host) throw new Error("That API address isn't valid. Use something like api.example.com.");
  const name = input.serviceName.trim().slice(0, 60);
  if (!name) throw new Error("Give the service a name.");
  const key = input.key.trim();
  if (key.length < 8 || key.length > 4000) throw new Error("That doesn't look like an API key.");
  const header = (input.header?.trim() || "Authorization").replace(/[^A-Za-z0-9-]/g, "");
  const config: ApiKeyConfig = {
    host,
    header,
    prefix: input.prefix ?? (header.toLowerCase() === "authorization" ? "Bearer " : ""),
    queryParam: input.queryParam?.trim().replace(/[^A-Za-z0-9_-]/g, "") || null,
  };

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", API_KEY_PROVIDER)
    .ilike("label", name)
    .maybeSingle();
  const values = {
    workspace_id: input.workspaceId,
    provider: API_KEY_PROVIDER,
    label: name,
    status: "connected",
    connected_by: input.userId,
    config: config as unknown as Json,
  };
  const { data: row, error } = existing
    ? await admin.from("integrations").update(values).eq("id", existing.id).select("id").single()
    : await admin.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(`Couldn't save the key: ${error?.message ?? "unknown error"}`);
  const { error: credError } = await admin.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    secret_enc: encrypt(key),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save the key: ${credError.message}`);
  return row.id;
}

export async function deleteConnection(workspaceId: string, integrationId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .delete()
    .eq("id", integrationId)
    .eq("workspace_id", workspaceId)
    .eq("provider", API_KEY_PROVIDER)
    .select("id");
  if (!data?.length) throw new Error("That connection wasn't found.");
}

async function listApiKeys(workspaceId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, label, config, created_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", API_KEY_PROVIDER)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({ id: r.id, name: r.label, config: r.config as unknown as ApiKeyConfig }));
}

// ---- Tools ----

type Input = Record<string, unknown>;
const s = (input: Input, key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

export const CONNECTION_TOOL_NAMES = new Set(["list_connections", "request_connection", "request_api_key", "api_request"]);

/** api_request changes things unless it's a GET: those wait for approval. */
export function connectionNeedsApproval(name: string, input: Input) {
  return name === "api_request" && s(input, "method").toUpperCase() !== "GET";
}

export async function listConnectionsText(workspaceId: string) {
  const [google, keys, ownApp, databases] = await Promise.all([
    listGoogleAccounts(workspaceId),
    listApiKeys(workspaceId),
    workspaceGoogleAppId(workspaceId),
    listDatabases(workspaceId),
  ]);
  const lines: string[] = [];
  lines.push(
    google.length
      ? `Google accounts (Gmail, Drive, Sheets, Calendar):\n${google
          .map((a) => `- ${a.email}${a.isDefault ? " (default)" : ""}${a.status === "error" ? " — needs reconnecting" : ""}`)
          .join("\n")}`
      : "Google: not connected yet. Use request_connection (service \"google\"): it shows a Connect button, or first a one-time setup card if this workspace hasn't added its Google app.",
  );
  lines.push(ownApp ? "This workspace has its own Google app set up." : "This workspace hasn't added its own Google app yet.");
  lines.push(
    keys.length
      ? `Services connected with an API key:\n${keys.map((k) => `- ${k.name} (host: ${k.config.host})`).join("\n")}`
      : "No services connected with an API key.",
  );
  lines.push(
    databases.length
      ? `Databases (read-only, use db_query):\n${databases.map((d) => `- ${d.name} (${d.config.engine}, database ${d.config.database})`).join("\n")}`
      : "No databases connected. Use request_database_connection to show the secure form.",
  );
  lines.push("Coming soon (sign-in): Slack, Microsoft Outlook/Teams, X (Twitter), HubSpot, Notion, Shopify.");
  return lines.join("\n\n");
}

const MAX_RESPONSE = 30_000;

/** Calls a service connected with an API key. The key is added here and never returned. */
export async function apiRequest(workspaceId: string, input: Input): Promise<{ text: string; isError: boolean }> {
  const name = s(input, "service_name");
  const method = s(input, "method").toUpperCase() || "GET";
  const path = s(input, "path");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return { text: `Method ${method} isn't allowed.`, isError: true };
  if (!path.startsWith("/") || path.startsWith("//")) return { text: "path must start with a single /", isError: true };

  const keys = await listApiKeys(workspaceId);
  const service = keys.find((k) => k.name.toLowerCase() === name.toLowerCase());
  if (!service) {
    return {
      text: `No service called "${name}" is connected. Connected: ${keys.map((k) => k.name).join(", ") || "none"}. Use request_api_key to add it.`,
      isError: true,
    };
  }
  const { data: cred } = await getSupabaseAdmin()
    .from("integration_credentials")
    .select("secret_enc")
    .eq("integration_id", service.id)
    .maybeSingle();
  if (!cred) return { text: `The key for ${service.name} is missing. Ask the user to add it again.`, isError: true };
  const key = decrypt(cred.secret_enc);

  const url = new URL(`https://${service.config.host}${path}`);
  if (url.host !== service.config.host) return { text: "That path points outside the service.", isError: true };
  const query = input.query && typeof input.query === "object" ? (input.query as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (service.config.queryParam) url.searchParams.set(service.config.queryParam, key);
  else headers[service.config.header] = `${service.config.prefix}${key}`;
  let body: string | undefined;
  if (input.body !== undefined && method !== "GET" && method !== "DELETE") {
    body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    headers["Content-Type"] = "application/json";
  }

  try {
    // No redirects: a redirect could carry the key to another host
    const response = await fetch(url, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    let text = await response.text();
    // Never echo the key back, even if the service does
    text = text.split(key).join("[key hidden]");
    if (text.length > MAX_RESPONSE) text = `${text.slice(0, MAX_RESPONSE)}\n…[cut off]`;
    const shownUrl = service.config.queryParam ? `${url.origin}${url.pathname}` : url.toString();
    return { text: `${method} ${shownUrl} → ${response.status}\n${text}`, isError: response.status >= 400 };
  } catch (error) {
    return { text: `Request failed: ${error instanceof Error ? error.message : error}`, isError: true };
  }
}

/** What the approval card shows for an api_request that changes something. */
export function apiRequestSummary(input: Input) {
  const body = input.body === undefined ? "" : `\n\n${(typeof input.body === "string" ? input.body : JSON.stringify(input.body, null, 2)).slice(0, 1200)}`;
  return `${s(input, "method").toUpperCase()} request to ${s(input, "service_name")}\nPath: ${s(input, "path")}${body}`;
}
