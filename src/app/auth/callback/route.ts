import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { safeNext } from "@/lib/auth/safe-next";
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
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth/callback]", error.message);
  }

  const failed = new URL(routes.signIn, url.origin);
  failed.searchParams.set("error", url.searchParams.get("error_description") ?? "That link is invalid or has expired.");
  return NextResponse.redirect(failed);
}
