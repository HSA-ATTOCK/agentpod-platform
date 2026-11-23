import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { canManage, getAppContext } from "@/lib/data/context";
import { authorizeUrl, isGoogleConfigured, newNonce, signState } from "@/lib/integrations/google/oauth";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { isAdminConfigured } from "@/lib/supabase/admin";

const NONCE_COOKIE = "baba_google_oauth";

/** GET /api/integrations/google/connect — starts "Connect Google" (owners and admins). */
export async function GET(request: Request) {
  const back = (message: string) => {
    const url = publicUrl(request, routes.integrations);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(publicUrl(request, routes.signIn));
  if (!canManage(ctx.workspace.role)) return back("Only owners and admins can connect tools.");
  if (!isGoogleConfigured()) return back("Google isn't set up on the server yet (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).");
  if (!isAdminConfigured()) return back("SUPABASE_SECRET_KEY is needed to store connections securely.");

  const nonce = newNonce();
  const state = signState({ workspaceId: ctx.workspace.id, userId: ctx.user.id, nonce });
  const response = NextResponse.redirect(authorizeUrl(publicOrigin(request), state));
  // Ties the Google callback to this browser
  response.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/google", maxAge: 600 });
  return response;
}
