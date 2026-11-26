import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { decrypt, encrypt } from "./crypto";

/**
 * Sign-in ("OAuth") connections other than Google: Slack, HubSpot and Microsoft 365.
 * Same model as Google:
 * - each workspace registers its own app with the provider and saves the Client ID + secret
 *   through a secure card (never in the chat);
 * - a workspace can connect several accounts; tokens are encrypted and refreshed on our server;
 * - nothing here is ever shown to Claude.
 */

export type OAuthProvider = "slack" | "hubspot" | "microsoft";

type ProviderConfig = {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Slack puts bot scopes in "scope" and user scopes in "user_scope". */
  scopeParam?: string;
  extraAuthorize?: Record<string, string>;
  /** Where to create the app, shown on the setup card. */
  setup: { consoleUrl: string; steps: string[] };
  clientIdPattern: RegExp;
};

export const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  slack: {
    name: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "channels:history", "groups:read", "groups:history", "chat:write", "users:read"],
    setup: {
      consoleUrl: "https://api.slack.com/apps",
      steps: [
        "Open api.slack.com/apps and click Create New App → From scratch. Name it (e.g. \"Baba\") and pick your Slack workspace.",
        "Go to OAuth & Permissions → Redirect URLs, add the address below and click Save URLs.",
        "Under Bot Token Scopes add: channels:read, channels:history, groups:read, groups:history, chat:write, users:read.",
        "Go to Basic Information → App Credentials and copy the Client ID and Client Secret into the boxes below.",
        "After saving, click Connect and approve. Invite the app to a channel (/invite @Baba) before Baba reads or posts there.",
      ],
    },
    clientIdPattern: /^[0-9]+\.[0-9]+$/,
  },
  hubspot: {
    name: "HubSpot",
    authorizeUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: ["oauth", "crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.companies.read", "crm.objects.deals.read"],
    setup: {
      consoleUrl: "https://developers.hubspot.com/",
      steps: [
        "Open developers.hubspot.com, sign in and create an app (Apps → Create app). Name it \"Baba\".",
        "In the Auth tab, add the Redirect URL below.",
        "Add the scopes: crm.objects.contacts.read, crm.objects.contacts.write, crm.objects.companies.read, crm.objects.deals.read.",
        "Copy the Client ID and Client secret from the Auth tab into the boxes below.",
        "After saving, click Connect and choose your HubSpot account.",
      ],
    },
    clientIdPattern: /^[0-9a-f-]{20,}$/i,
  },
  microsoft: {
    name: "Microsoft 365 (Outlook)",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "openid", "email", "User.Read", "Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite"],
    extraAuthorize: { prompt: "select_account", response_mode: "query" },
    setup: {
      consoleUrl: "https://entra.microsoft.com/",
      steps: [
        "Open entra.microsoft.com → Applications → App registrations → New registration. Name it \"Baba\".",
        "Supported account types: \"Accounts in any organizational directory and personal Microsoft accounts\".",
        "Redirect URI: choose Web and paste the address below. Click Register.",
        "Copy the Application (client) ID into the box below.",
        "Certificates & secrets → New client secret → copy its Value into the secret box below.",
        "API permissions → Add → Microsoft Graph → Delegated: User.Read, Mail.ReadWrite, Mail.Send, Calendars.ReadWrite, offline_access.",
      ],
    },
    clientIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },
};

export const isOAuthProvider = (value: unknown): value is OAuthProvider => typeof value === "string" && value in PROVIDERS;
const appProvider = (p: OAuthProvider) => `${p}_app`;
export const oauthRedirectUri = (origin: string, p: OAuthProvider) => `${origin}/api/integrations/oauth/${p}/callback`;

// ---------------------------------------------------------------------------
// The workspace's own app (Client ID + secret)
// ---------------------------------------------------------------------------

export type OAuthClient = { id: string; secret: string };

export async function oauthClientFor(workspaceId: string, p: OAuthProvider): Promise<OAuthClient | null> {
  const db = getSupabaseAdmin();
  const { data: row } = await db.from("integrations").select("id, config").eq("workspace_id", workspaceId).eq("provider", appProvider(p)).maybeSingle();
  if (!row) return null;
  const { data: cred } = await db.from("integration_credentials").select("secret_enc").eq("integration_id", row.id).maybeSingle();
  const id = (row.config as { clientId?: string } | null)?.clientId;
  return id && cred ? { id, secret: decrypt(cred.secret_enc) } : null;
}

export async function oauthAppId(workspaceId: string, p: OAuthProvider) {
  const { data } = await getSupabaseAdmin().from("integrations").select("config").eq("workspace_id", workspaceId).eq("provider", appProvider(p)).maybeSingle();
  return (data?.config as { clientId?: string } | null)?.clientId ?? null;
}

export async function saveOAuthApp(input: { workspaceId: string; userId: string; provider: OAuthProvider; clientId: string; clientSecret: string }) {
  const cfg = PROVIDERS[input.provider];
  const clientId = input.clientId.trim();
  const secret = input.clientSecret.trim();
  if (!cfg.clientIdPattern.test(clientId)) throw new Error(`That doesn't look like a ${cfg.name} Client ID.`);
  if (secret.length < 8 || secret.length > 500) throw new Error("Paste the whole client secret.");
  const db = getSupabaseAdmin();
  const { data: existing } = await db.from("integrations").select("id").eq("workspace_id", input.workspaceId).eq("provider", appProvider(input.provider)).maybeSingle();
  const values = {
    workspace_id: input.workspaceId,
    provider: appProvider(input.provider),
    label: `${cfg.name} app`,
    status: "connected",
    connected_by: input.userId,
    config: { clientId } as unknown as Json,
  };
  const { data: row, error } = existing
    ? await db.from("integrations").update(values).eq("id", existing.id).select("id").single()
    : await db.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(`Couldn't save: ${error?.message ?? "unknown error"}`);
  const { error: credError } = await db.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    secret_enc: encrypt(secret),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save: ${credError.message}`);
}

export async function removeOAuthApp(workspaceId: string, p: OAuthProvider) {
  await getSupabaseAdmin().from("integrations").delete().eq("workspace_id", workspaceId).eq("provider", appProvider(p));
}

// ---------------------------------------------------------------------------
// Sign-in and tokens
// ---------------------------------------------------------------------------

export function oauthAuthorizeUrl(origin: string, p: OAuthProvider, state: string, client: OAuthClient) {
  const cfg = PROVIDERS[p];
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("redirect_uri", oauthRedirectUri(origin, p));
  url.searchParams.set("response_type", "code");
  url.searchParams.set(cfg.scopeParam ?? "scope", cfg.scopes.join(p === "slack" ? "," : " "));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(cfg.extraAuthorize ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

type TokenResponse = {
  ok?: boolean;
  error?: string;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  team?: { id: string; name: string };
  authed_user?: { id: string };
};

async function tokenRequest(p: OAuthProvider, client: OAuthClient, params: Record<string, string>) {
  const res = await fetch(PROVIDERS[p].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...params }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.ok === false || !data.access_token) {
    throw new Error(data.error_description || data.error || `${PROVIDERS[p].name} sign-in failed (${res.status}).`);
  }
  return data;
}

/** Who the token belongs to (shown in lists, and lets Baba pick an account). */
async function accountLabel(p: OAuthProvider, token: TokenResponse) {
  try {
    if (p === "slack") return token.team?.name ?? "Slack workspace";
    if (p === "hubspot") {
      const info = (await (await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token.access_token!)}`)).json()) as { hub_domain?: string; user?: string };
      return info.hub_domain ?? info.user ?? "HubSpot account";
    }
    const me = (await (await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${token.access_token}` } })).json()) as { mail?: string; userPrincipalName?: string };
    return me.mail ?? me.userPrincipalName ?? "Microsoft account";
  } catch {
    return PROVIDERS[p].name;
  }
}

/** Swaps the sign-in code for tokens and saves the connection (one row per account). */
export async function completeOAuthConnection(input: { provider: OAuthProvider; code: string; origin: string; workspaceId: string; userId: string }) {
  const client = await oauthClientFor(input.workspaceId, input.provider);
  if (!client) throw new Error(`This workspace's ${PROVIDERS[input.provider].name} app is missing. Set it up again.`);
  const token = await tokenRequest(input.provider, client, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: oauthRedirectUri(input.origin, input.provider),
  });
  const label = (await accountLabel(input.provider, token)).slice(0, 120);
  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .ilike("label", label)
    .maybeSingle();
  const { count } = await db.from("integrations").select("id", { count: "exact", head: true }).eq("workspace_id", input.workspaceId).eq("provider", input.provider);
  const values = {
    workspace_id: input.workspaceId,
    provider: input.provider,
    label,
    account_email: input.provider === "microsoft" ? label : null,
    status: "connected",
    connected_by: input.userId,
    is_default: !existing && !count,
    scopes: PROVIDERS[input.provider].scopes,
    config: {} as Json,
  };
  const { data: row, error } = existing
    ? await db.from("integrations").update({ ...values, is_default: undefined }).eq("id", existing.id).select("id").single()
    : await db.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(error?.code === "P0001" ? error.message : `Couldn't save the connection: ${error?.message ?? "unknown"}`);
  await db.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    // Refresh token when there is one (HubSpot, Microsoft); Slack bot tokens don't expire
    secret_enc: encrypt(token.refresh_token ?? token.access_token!),
    access_token_enc: encrypt(token.access_token!),
    access_token_expires_at: token.expires_in ? new Date(Date.now() + (token.expires_in - 60) * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  return label;
}

export type OAuthAccount = { id: string; label: string; isDefault: boolean; status: string };

export async function listOAuthAccounts(workspaceId: string, p: OAuthProvider): Promise<OAuthAccount[]> {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, label, is_default, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", p)
    .order("created_at");
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, isDefault: r.is_default, status: r.status }));
}

/** A working access token for the account (refreshed when needed), or null if not connected. */
export async function oauthAccessToken(workspaceId: string, p: OAuthProvider, account?: string) {
  const accounts = await listOAuthAccounts(workspaceId, p);
  const chosen = account ? accounts.find((a) => a.label.toLowerCase() === account.toLowerCase()) : (accounts.find((a) => a.isDefault) ?? accounts[0]);
  if (!chosen) return null;
  const db = getSupabaseAdmin();
  const { data: cred } = await db.from("integration_credentials").select("secret_enc, access_token_enc, access_token_expires_at").eq("integration_id", chosen.id).maybeSingle();
  if (!cred) return null;
  const fresh = cred.access_token_enc && (!cred.access_token_expires_at || Date.parse(cred.access_token_expires_at) > Date.now());
  if (fresh) return { token: decrypt(cred.access_token_enc!), label: chosen.label };
  const client = await oauthClientFor(workspaceId, p);
  if (!client) return null;
  try {
    const token = await tokenRequest(p, client, { grant_type: "refresh_token", refresh_token: decrypt(cred.secret_enc) });
    await db
      .from("integration_credentials")
      .update({
        access_token_enc: encrypt(token.access_token!),
        ...(token.refresh_token ? { secret_enc: encrypt(token.refresh_token) } : {}),
        access_token_expires_at: token.expires_in ? new Date(Date.now() + (token.expires_in - 60) * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("integration_id", chosen.id);
    await db.from("integrations").update({ status: "connected" }).eq("id", chosen.id);
    return { token: token.access_token!, label: chosen.label };
  } catch (error) {
    // Revoked or expired: ask for a reconnect
    await db.from("integrations").update({ status: "error" }).eq("id", chosen.id);
    console.error(`[${p}] token refresh failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function disconnectOAuth(workspaceId: string, integrationId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .delete()
    .eq("id", integrationId)
    .eq("workspace_id", workspaceId)
    .in("provider", Object.keys(PROVIDERS))
    .select("id");
  if (!data?.length) throw new Error("That connection wasn't found.");
}
