import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "../crypto";

/**
 * "Connect Google" for a workspace: OAuth sign-in, token storage (encrypted, server-only)
 * and fresh access tokens for Baba's Google tools.
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

type State = { workspaceId: string; userId: string; nonce: string };

function stateKey() {
  return createHmac("sha256", "baba-oauth-state").update(process.env.GOOGLE_CLIENT_SECRET ?? "").digest();
}

export function signState(state: State) {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readState(value: string | null): State | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateKey()).update(body).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as State;
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
  url.searchParams.set("prompt", "consent"); // always return a refresh token
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

/** Finishes the sign-in: swaps the code for tokens and saves them for the workspace. */
export async function completeConnection(input: { code: string; origin: string; workspaceId: string; userId: string }) {
  const tokens = await tokenRequest({
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(input.origin),
  });
  if (!tokens.refresh_token) throw new Error("Google didn't return a refresh token. Please try connecting again.");

  // Which Google account was connected (from the ID token; it came straight from Google over TLS)
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()) as { email?: string };
      email = payload.email ?? null;
    } catch {
      email = null;
    }
  }

  const admin = getSupabaseAdmin();
  const { error: credError } = await admin.from("integration_credentials").upsert({
    workspace_id: input.workspaceId,
    provider: GOOGLE_PROVIDER,
    refresh_token_enc: encrypt(tokens.refresh_token),
    access_token_enc: encrypt(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (credError) throw new Error(`Couldn't save the connection: ${credError.message}`);

  const { error } = await admin.from("integrations").upsert(
    {
      workspace_id: input.workspaceId,
      provider: GOOGLE_PROVIDER,
      status: "connected",
      connected_by: input.userId,
      account_email: email,
      scopes: tokens.scope.split(" "),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(`Couldn't save the connection: ${error.message}`);
  return email;
}

/** A valid access token for the workspace's Google account, refreshing it when needed. */
export async function googleAccessToken(workspaceId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("integration_credentials")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  if (!data) return null;

  if (data.access_token_enc && data.access_token_expires_at && Date.parse(data.access_token_expires_at) > Date.now()) {
    return decrypt(data.access_token_enc);
  }

  try {
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(data.refresh_token_enc) });
    await admin
      .from("integration_credentials")
      .update({
        access_token_enc: encrypt(tokens.access_token),
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("provider", GOOGLE_PROVIDER);
    return tokens.access_token;
  } catch (error) {
    // Revoked or expired for good: show it on the Integrations page
    await admin.from("integrations").update({ status: "error" }).eq("workspace_id", workspaceId).eq("provider", GOOGLE_PROVIDER);
    throw new Error(`Google sign-in expired or was revoked. Reconnect Google in Integrations. (${error instanceof Error ? error.message : error})`);
  }
}

/** Disconnects: revokes the token at Google (best effort) and deletes it here. */
export async function disconnectGoogle(workspaceId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("integration_credentials")
    .select("refresh_token_enc")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();
  if (data) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(data.refresh_token_enc))}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await admin.from("integration_credentials").delete().eq("workspace_id", workspaceId).eq("provider", GOOGLE_PROVIDER);
  await admin.from("integrations").delete().eq("workspace_id", workspaceId).eq("provider", GOOGLE_PROVIDER);
}
