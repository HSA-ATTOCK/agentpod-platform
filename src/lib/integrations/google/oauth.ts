import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "../crypto";

/**
 * "Connect Google": each workspace can connect one or more Google accounts.
 *
 * Signing in needs a Google "OAuth app" (Client ID + secret). Each workspace can add its own
 * from the chat (secure card) or the Integrations page; it's stored encrypted for that
 * workspace only. Optionally the platform can provide one shared app with GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET, used when a workspace hasn't added its own.
 * Account tokens are stored encrypted, server-only.
 */

export const GOOGLE_PROVIDER = "google";

/** What Baba may do. Sending and creating events still need a person's approval in Baba. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.events",
];

/** A shared Google app provided by the platform (optional). */
export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const GOOGLE_APP_PROVIDER = "google_app";

export type GoogleClient = { id: string; secret: string; source: "workspace" | "platform" };

const CLIENT_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;

/** The workspace's own Google app, if it added one. */
async function workspaceGoogleApp(workspaceId: string): Promise<GoogleClient | null> {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("integrations")
    .select("id, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_APP_PROVIDER)
    .maybeSingle();
  if (!row) return null;
  const { data: cred } = await admin.from("integration_credentials").select("secret_enc").eq("integration_id", row.id).maybeSingle();
  const id = (row.config as { client_id?: string } | null)?.client_id;
  if (!cred || !id) return null;
  return { id, secret: decrypt(cred.secret_enc), source: "workspace" };
}

/**
 * Which Google app to sign in with for a workspace: its own (if added), else the platform's.
 * `prefer` keeps using the app an account was connected with (its tokens only work with that app).
 */
export async function googleClientFor(workspaceId: string, prefer?: "workspace" | "platform"): Promise<GoogleClient | null> {
  const platform: GoogleClient | null = isGoogleConfigured()
    ? { id: process.env.GOOGLE_CLIENT_ID!, secret: process.env.GOOGLE_CLIENT_SECRET!, source: "platform" }
    : null;
  if (prefer === "platform") return platform;
  const own = await workspaceGoogleApp(workspaceId);
  if (prefer === "workspace") return own;
  return own ?? platform;
}

/** Saves (or replaces) the workspace's own Google app. */
export async function saveGoogleApp(input: { workspaceId: string; userId: string; clientId: string; clientSecret: string }) {
  const clientId = input.clientId.trim();
  const secret = input.clientSecret.trim();
  if (!CLIENT_ID.test(clientId)) throw new Error("That Client ID doesn't look right. It ends with .apps.googleusercontent.com.");
  if (secret.length < 10 || secret.length > 200 || /\s/.test(secret)) throw new Error("That Client secret doesn't look right. It usually starts with GOCSPX-.");
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", GOOGLE_APP_PROVIDER)
    .maybeSingle();
  const values = {
    workspace_id: input.workspaceId,
    provider: GOOGLE_APP_PROVIDER,
    label: "Google app",
    status: "connected",
    connected_by: input.userId,
    config: { client_id: clientId },
  };
  const { data: row, error } = existing
    ? await admin.from("integrations").update(values).eq("id", existing.id).select("id").single()
    : await admin.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(`Couldn't save the Google app: ${error?.message ?? "unknown error"}`);
  const { error: credError } = await admin.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    secret_enc: encrypt(secret),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save the Google app: ${credError.message}`);
}

export async function removeGoogleApp(workspaceId: string) {
  await getSupabaseAdmin().from("integrations").delete().eq("workspace_id", workspaceId).eq("provider", GOOGLE_APP_PROVIDER);
}

/** The workspace's own Google app's Client ID (never the secret), for showing on screen. */
export async function workspaceGoogleAppId(workspaceId: string) {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_APP_PROVIDER)
    .maybeSingle();
  return (data?.config as { client_id?: string } | null)?.client_id ?? null;
}

export function redirectUri(origin: string) {
  return `${origin}/api/integrations/google/callback`;
}

// ---- The "state" value: proves the callback belongs to a sign-in this app started ----

export type OAuthState = {
  workspaceId: string;
  userId: string;
  nonce: string;
  /** Opened from the chat in a small window: close it and tell the chat when done. */
  popup?: boolean;
  /** Same-tab fallback: where to go back to (an in-app path). */
  returnTo?: string;
  /** Which Google app the sign-in used. */
  client?: "workspace" | "platform";
};

function stateKey() {
  // A server secret that doesn't depend on any particular Google app
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY || process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("No server secret to sign the Google sign-in with (set SUPABASE_SECRET_KEY).");
  return createHmac("sha256", "baba-oauth-state").update(secret).digest();
}

export function signState(state: OAuthState) {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(value: string | null): OAuthState | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateKey()).update(body).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthState;
  } catch {
    return null;
  }
}

export function newNonce() {
  return randomBytes(16).toString("base64url");
}

export function authorizeUrl(origin: string, state: string, client: GoogleClient) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline"); // gives a refresh token
  url.searchParams.set("prompt", "consent select_account"); // refresh token + choose which account
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(client: GoogleClient, params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      ...params,
    }),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || `Google returned ${response.status}`);
  return data;
}

/** Finishes the sign-in: swaps the code for tokens and saves the account for the workspace. */
export async function completeConnection(input: {
  code: string;
  origin: string;
  workspaceId: string;
  userId: string;
  client?: "workspace" | "platform";
}) {
  const client = await googleClientFor(input.workspaceId, input.client);
  if (!client) throw new Error("This workspace's Google app is missing. Add it again and reconnect.");
  const tokens = await tokenRequest(client, {
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(input.origin),
  });
  if (!tokens.refresh_token) throw new Error("Google didn't return a refresh token. Please try connecting again.");

  // Which Google account was connected (from the ID token, which came straight from Google over TLS)
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) as { email?: string };
      email = payload.email?.toLowerCase() ?? null;
    } catch {
      email = null;
    }
  }
  if (!email) throw new Error("Google didn't tell us which account was connected. Please try again.");

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("integrations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", GOOGLE_PROVIDER);
  const { data: same } = await admin
    .from("integrations")
    .select("id, is_default")
    .eq("workspace_id", input.workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .ilike("account_email", email)
    .maybeSingle();

  const values = {
    workspace_id: input.workspaceId,
    provider: GOOGLE_PROVIDER,
    status: "connected",
    connected_by: input.userId,
    account_email: email,
    label: email,
    scopes: tokens.scope.split(" "),
    // Tokens only work with the app that issued them
    config: { oauth_client: client.source },
    // The first Google account is the default one
    is_default: same ? same.is_default : (existing ?? []).length === 0,
  };
  const { data: row, error } = same
    ? await admin.from("integrations").update(values).eq("id", same.id).select("id").single()
    : await admin.from("integrations").insert(values).select("id").single();
  if (error || !row) throw new Error(`Couldn't save the connection: ${error?.message ?? "unknown error"}`);

  const { error: credError } = await admin.from("integration_credentials").upsert({
    integration_id: row.id,
    workspace_id: input.workspaceId,
    secret_enc: encrypt(tokens.refresh_token),
    access_token_enc: encrypt(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save the connection: ${credError.message}`);
  return email;
}

export type GoogleAccount = { id: string; email: string; isDefault: boolean; status: string; client: "workspace" | "platform" };

/** The workspace's connected Google accounts, default first. */
export async function listGoogleAccounts(workspaceId: string): Promise<GoogleAccount[]> {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, account_email, is_default, status, created_at, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.account_email ?? "",
    isDefault: r.is_default,
    status: r.status,
    client: (r.config as { oauth_client?: "workspace" | "platform" } | null)?.oauth_client ?? "platform",
  }));
}

/**
 * A valid access token for one of the workspace's Google accounts (by email, or the default),
 * refreshing it when needed. Throws a message Baba can show if there's a problem.
 */
export async function googleAccessToken(workspaceId: string, accountEmail?: string) {
  const accounts = await listGoogleAccounts(workspaceId);
  if (accounts.length === 0) return null;
  const wanted = accountEmail?.trim().toLowerCase();
  const account = wanted ? accounts.find((a) => a.email.toLowerCase() === wanted) : accounts[0];
  if (!account) {
    throw new Error(`"${accountEmail}" isn't connected. Connected Google accounts: ${accounts.map((a) => a.email).join(", ")}.`);
  }

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("integration_credentials")
    .select("secret_enc, access_token_enc, access_token_expires_at")
    .eq("integration_id", account.id)
    .maybeSingle();
  if (!data) throw new Error(`The connection for ${account.email} is incomplete. Reconnect it in Integrations.`);

  if (data.access_token_enc && data.access_token_expires_at && Date.parse(data.access_token_expires_at) > Date.now()) {
    return { token: decrypt(data.access_token_enc), email: account.email };
  }

  try {
    const client = await googleClientFor(workspaceId, account.client);
    if (!client) throw new Error("the Google app this account was connected with was removed");
    const tokens = await tokenRequest(client, { grant_type: "refresh_token", refresh_token: decrypt(data.secret_enc) });
    await admin
      .from("integration_credentials")
      .update({
        access_token_enc: encrypt(tokens.access_token),
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("integration_id", account.id);
    if (account.status !== "connected") await admin.from("integrations").update({ status: "connected" }).eq("id", account.id);
    return { token: tokens.access_token, email: account.email };
  } catch (error) {
    // Revoked or expired for good: show it on the Integrations page
    await admin.from("integrations").update({ status: "error" }).eq("id", account.id);
    throw new Error(
      `Google access for ${account.email} expired or was revoked. Reconnect it in Integrations. (${error instanceof Error ? error.message : error})`,
    );
  }
}

/** Disconnects one Google account: revokes the token at Google (best effort) and deletes it here. */
export async function disconnectGoogle(workspaceId: string, integrationId: string) {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("integrations")
    .select("id, is_default")
    .eq("id", integrationId)
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  if (!row) throw new Error("That connection wasn't found.");
  const { data: cred } = await admin.from("integration_credentials").select("secret_enc").eq("integration_id", row.id).maybeSingle();
  if (cred) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(cred.secret_enc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await admin.from("integrations").delete().eq("id", row.id);
  // Keep a default if other accounts remain
  if (row.is_default) {
    const [next] = await listGoogleAccounts(workspaceId);
    if (next) await admin.from("integrations").update({ is_default: true }).eq("id", next.id);
  }
}

/** Makes one Google account the one Baba uses unless told otherwise. */
export async function setDefaultGoogle(workspaceId: string, integrationId: string) {
  const admin = getSupabaseAdmin();
  await admin.from("integrations").update({ is_default: false }).eq("workspace_id", workspaceId).eq("provider", GOOGLE_PROVIDER);
  const { data } = await admin
    .from("integrations")
    .update({ is_default: true })
    .eq("id", integrationId)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();
  if (!data) throw new Error("That connection wasn't found.");
}
