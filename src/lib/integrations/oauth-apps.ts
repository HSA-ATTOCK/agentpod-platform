import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { decrypt, encrypt } from "./crypto";
import { likeExact } from "@/lib/utils";

/**
 * Sign-in ("OAuth") connections other than Google: Slack, HubSpot and Microsoft 365.
 * Same model as Google:
 * - each workspace registers its own app with the provider and saves the Client ID + secret
 *   through a secure card (never in the chat);
 * - a workspace can connect several accounts; tokens are encrypted and refreshed on our server;
 * - nothing here is ever shown to Claude.
 */

export type OAuthProvider = "slack" | "hubspot" | "microsoft" | "quickbooks" | "xero" | "shopify";

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
  /** Send the client ID/secret as HTTP Basic auth to the token endpoint (QuickBooks, Xero). */
  tokenAuth?: "basic";
  /** Shopify: the sign-in and token addresses depend on the store. */
  perShop?: boolean;
};

/** A store's address, e.g. "acme" or "acme.myshopify.com" -> "acme.myshopify.com" (or null). */
export function cleanShop(value: string) {
  const v = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const shop = v.endsWith(".myshopify.com") ? v : `${v}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ? shop : null;
}

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
  quickbooks: {
    name: "QuickBooks",
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: ["com.intuit.quickbooks.accounting"],
    tokenAuth: "basic",
    setup: {
      consoleUrl: "https://developer.intuit.com/app/developer/dashboard",
      steps: [
        "Open developer.intuit.com, sign in and create an app (Dashboard → Create an app → QuickBooks Online and Payments). Name it \"Baba\".",
        "Choose the scope com.intuit.quickbooks.accounting.",
        "Under Keys & credentials (Production — or Development to test with a sandbox company), add the Redirect URI below.",
        "Copy the Client ID and Client Secret into the boxes below.",
        "Baba only reads your books (reports, invoices, customers); it never creates payments or changes entries.",
      ],
    },
    clientIdPattern: /^[A-Za-z0-9]{20,}$/,
  },
  xero: {
    name: "Xero",
    authorizeUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: ["openid", "profile", "email", "offline_access", "accounting.transactions.read", "accounting.reports.read", "accounting.contacts.read", "accounting.settings.read"],
    tokenAuth: "basic",
    setup: {
      consoleUrl: "https://developer.xero.com/app/manage",
      steps: [
        "Open developer.xero.com/app/manage → New app. Choose \"Web app\", name it \"Baba\", add your company URL.",
        "Paste the Redirect URI below into \"Redirect URI\" and create the app.",
        "Under Configuration, generate a client secret. Copy the Client ID and the secret into the boxes below.",
        "Baba only reads your books (reports, invoices, contacts); it never changes them.",
      ],
    },
    clientIdPattern: /^[A-F0-9]{32}$/i,
  },
  shopify: {
    name: "Shopify",
    authorizeUrl: "https://{shop}/admin/oauth/authorize",
    tokenUrl: "https://{shop}/admin/oauth/access_token",
    scopes: ["read_orders", "read_products", "read_customers", "read_inventory"],
    perShop: true,
    setup: {
      consoleUrl: "https://partners.shopify.com/",
      steps: [
        "Open the Shopify Partner dashboard (or your store's Settings → Apps → Develop apps) and create an app named \"Baba\".",
        "Set the App URL to your Baba address and add the Redirect URL below to the allowed redirection URLs.",
        "Admin API scopes: read_orders, read_products, read_customers, read_inventory.",
        "Copy the Client ID (API key) and Client secret (API secret key) into the boxes below.",
        "When you connect, enter your store address (e.g. your-store.myshopify.com).",
      ],
    },
    clientIdPattern: /^[a-f0-9]{32}$/i,
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

export function oauthAuthorizeUrl(origin: string, p: OAuthProvider, state: string, client: OAuthClient, shop?: string) {
  const cfg = PROVIDERS[p];
  if (cfg.perShop && !shop) throw new Error("Enter your store address.");
  const url = new URL(cfg.authorizeUrl.replace("{shop}", shop ?? ""));
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

async function tokenRequest(p: OAuthProvider, client: OAuthClient, params: Record<string, string>, shop?: string) {
  const cfg = PROVIDERS[p];
  const basic = cfg.tokenAuth === "basic";
  const res = await fetch(cfg.tokenUrl.replace("{shop}", shop ?? ""), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...(basic ? { Authorization: `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString("base64")}` } : {}),
    },
    body: new URLSearchParams(basic ? params : { client_id: client.id, client_secret: client.secret, ...params }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.ok === false || !data.access_token) {
    throw new Error(data.error_description || data.error || `${PROVIDERS[p].name} sign-in failed (${res.status}).`);
  }
  return data;
}

/** Who the token belongs to (shown in lists, and lets Baba pick an account), plus what the API calls need. */
async function accountInfo(p: OAuthProvider, token: TokenResponse, extra: Record<string, string>): Promise<{ label: string; config: Record<string, string> }> {
  try {
    if (p === "quickbooks") {
      const realmId = extra.realmId;
      if (!realmId) throw new Error("QuickBooks didn't say which company was chosen.");
      const base = process.env.QUICKBOOKS_SANDBOX === "true" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
      const info = (await (await fetch(`${base}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=75`, { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" } })).json()) as {
        CompanyInfo?: { CompanyName?: string };
      };
      return { label: info.CompanyInfo?.CompanyName ?? `QuickBooks company ${realmId}`, config: { realmId, base } };
    }
    if (p === "xero") {
      const tenants = (await (await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${token.access_token}` } })).json()) as { tenantId: string; tenantName: string }[];
      if (!tenants?.[0]) throw new Error("No Xero organisation was chosen.");
      return { label: tenants[0].tenantName, config: { tenantId: tenants[0].tenantId } };
    }
    if (p === "shopify") return { label: extra.shop, config: { shop: extra.shop } };
    return { label: await accountLabel(p, token), config: {} };
  } catch (error) {
    if (p === "quickbooks" || p === "xero" || p === "shopify") throw error;
    return { label: PROVIDERS[p].name, config: {} };
  }
}

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
export async function completeOAuthConnection(input: {
  provider: OAuthProvider;
  code: string;
  origin: string;
  workspaceId: string;
  userId: string;
  /** Values the provider adds to the callback (QuickBooks realmId, Shopify shop). */
  extra?: Record<string, string>;
}) {
  const client = await oauthClientFor(input.workspaceId, input.provider);
  if (!client) throw new Error(`This workspace's ${PROVIDERS[input.provider].name} app is missing. Set it up again.`);
  const extra = input.extra ?? {};
  const token = await tokenRequest(
    input.provider,
    client,
    { grant_type: "authorization_code", code: input.code, redirect_uri: oauthRedirectUri(input.origin, input.provider) },
    extra.shop,
  );
  const info = await accountInfo(input.provider, token, extra);
  const label = info.label.slice(0, 120);
  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", input.provider)
    .ilike("label", likeExact(label))
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
    config: info.config as unknown as Json,
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

export type OAuthAccount = { id: string; label: string; isDefault: boolean; status: string; config: Record<string, string> };

export async function listOAuthAccounts(workspaceId: string, p: OAuthProvider): Promise<OAuthAccount[]> {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, label, is_default, status, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", p)
    .order("created_at");
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, isDefault: r.is_default, status: r.status, config: (r.config ?? {}) as Record<string, string> }));
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
  if (fresh) return { token: decrypt(cred.access_token_enc!), label: chosen.label, config: chosen.config };
  const client = await oauthClientFor(workspaceId, p);
  if (!client) return null;
  try {
    const token = await tokenRequest(p, client, { grant_type: "refresh_token", refresh_token: decrypt(cred.secret_enc) }, chosen.config.shop);
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
    return { token: token.access_token!, label: chosen.label, config: chosen.config };
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

/**
 * Shopify signs its callback: hex HMAC-SHA256 (with the app secret) of the other query
 * parameters, sorted. Returns true only if it matches.
 */
export function verifyShopifyHmac(params: URLSearchParams, secret: string) {
  const hmac = params.get("hmac");
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  return expected.length === hmac.length && timingSafeEqual(Buffer.from(expected), Buffer.from(hmac));
}
