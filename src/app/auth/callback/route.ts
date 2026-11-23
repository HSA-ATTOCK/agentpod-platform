import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { safeNext } from "@/lib/auth/safe-next";
import { publicUrl } from "@/lib/origin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /auth/callback — where Supabase sends people back after
 * verifying their email, signing in with Google, or opening a password-reset link.
 * Swaps the one-time code for a session cookie, then continues to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(publicUrl(request, next));
    console.error("[auth/callback]", error.message);
  }

  const failed = publicUrl(request, routes.signIn);
  const expired = url.searchParams.get("error_code") === "otp_expired" || !code;
  failed.searchParams.set(
    "error",
    expired
      ? "That email link has expired or was already used. If you already confirmed your email, just sign in. Otherwise request a new link."
      : (url.searchParams.get("error_description") ?? "That link didn't work. Please try again."),
  );
  return NextResponse.redirect(failed);
}
