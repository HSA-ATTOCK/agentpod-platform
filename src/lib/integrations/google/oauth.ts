import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "../crypto";

/**
 * "Connect Google": each workspace can connect one or more Google accounts.
 * GOOGLE_CLIENT_ID / SECRET identify Baba (the app) to Google, set once by the platform
 * owner. Each customer just signs in; their tokens are stored encrypted, server-only.
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

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
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
};

function stateKey() {
  return createHmac("sha256", "baba-oauth-state").update(process.env.GOOGLE_CLIENT_SECRET ?? "").digest();
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

export function authorizeUrl(origin: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
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

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || `Google returned ${response.status}`);
  return data;
}

/** Finishes the sign-in: swaps the code for tokens and saves the account for the workspace. */
export async function completeConnection(input: { code: string; origin: string; workspaceId: string; userId: string }) {
  const tokens = await tokenRequest({
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

export type GoogleAccount = { id: string; email: string; isDefault: boolean; status: string };

/** The workspace's connected Google accounts, default first. */
export async function listGoogleAccounts(workspaceId: string): Promise<GoogleAccount[]> {
  const { data } = await getSupabaseAdmin()
    .from("integrations")
    .select("id, account_email, is_default, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({ id: r.id, email: r.account_email ?? "", isDefault: r.is_default, status: r.status }));
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
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(data.secret_enc) });
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
