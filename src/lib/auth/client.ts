"use client";

import type { AuthError } from "@supabase/supabase-js";
import { routes } from "@/config/routes";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "./safe-next";

/** Real Supabase Auth calls used by the sign-in, sign-up and password forms. */

export type AuthResult = { ok: true } | { ok: false; error: string };

function callbackUrl(next: string) {
  const url = new URL(routes.authCallback, window.location.origin);
  url.searchParams.set("next", safeNext(next));
  return url.toString();
}

function friendly(error: AuthError | Error): string {
  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Check them and try again.";
    case "email_not_confirmed":
      return "Please verify your email first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "That password is too weak. Choose a longer, less common one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "same_password":
      return "Your new password must be different from your old one.";
    case "validation_failed":
      return "Please check the details you entered.";
    default:
      if (/provider is not enabled/i.test(error.message)) {
        return "Google sign-in isn't switched on yet. Use email and password for now.";
      }
      return error.message || "Something went wrong. Please try again.";
  }
}

function result(error: AuthError | Error | null): AuthResult {
  return error ? { ok: false, error: friendly(error) } : { ok: true };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
  return result(error);
}

export type SignUpResult = { ok: true; needsVerification: boolean } | { ok: false; error: string };

/** Creates the account. Supabase emails a verification link that lands on /auth/callback. */
export async function signUpWithPassword(fullName: string, email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await getSupabaseBrowser().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: callbackUrl(routes.ask) },
  });
  if (error) return { ok: false, error: friendly(error) };
  // A session straight away means email confirmation is switched off in Supabase
  return { ok: true, needsVerification: !data.session };
}

/** Sends the browser to Google, which returns to /auth/callback. */
export async function signInWithGoogle(next: string = routes.ask): Promise<AuthResult> {
  const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  return result(error);
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: callbackUrl(routes.resetPassword),
  });
  return result(error);
}

export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  const { error } = await getSupabaseBrowser().auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: callbackUrl(routes.ask) },
  });
  return result(error);
}

/** True when this account has two-step verification on and the session still needs a code. */
export async function needsTwoFactor() {
  const { data } = await getSupabaseBrowser().auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/** Checks a 6-digit code from the authenticator app and upgrades the session. */
export async function verifyTwoFactorCode(code: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowser();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: friendly(listError) };
  const factor = factors.totp.find((f) => f.status === "verified");
  if (!factor) return { ok: false, error: "No authenticator app is set up for this account." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s+/g, "") });
  if (error) {
    return { ok: false, error: /invalid|expired/i.test(error.message) ? "That code isn't right. Check the app and try the newest code." : friendly(error) };
  }
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await getSupabaseBrowser().auth.updateUser({ password });
  return result(error);
}
