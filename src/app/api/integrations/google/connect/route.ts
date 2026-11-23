import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { safeNext } from "@/lib/auth/safe-next";
import { canManage, getAppContext } from "@/lib/data/context";
import { authorizeUrl, googleClientFor, newNonce, signState } from "@/lib/integrations/google/oauth";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { popupResult } from "../popup-result";

const NONCE_COOKIE = "baba_google_oauth";

/**
 * GET /api/integrations/google/connect — starts "Connect Google" (owners and admins).
 * ?popup=1   opened from the chat in a small window (closes itself when done)
 * ?return=…  same-tab: where to come back to (an in-app path)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const popup = url.searchParams.get("popup") === "1";
  const returnTo = safeNext(url.searchParams.get("return"), routes.integrations);
  const fail = (message: string) => {
    if (popup) return popupResult(request, { ok: false, error: message });
    const target = publicUrl(request, returnTo);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  };

  const ctx = await getAppContext();
  if (!ctx) return popup ? fail("Please sign in to Baba first.") : NextResponse.redirect(publicUrl(request, routes.signIn));
  if (!canManage(ctx.workspace.role)) return fail("Only owners and admins can connect tools. Ask one of them to connect Google.");
  if (!isAdminConfigured()) return fail("Connections can't be stored securely on this server yet.");
  const client = await googleClientFor(ctx.workspace.id);
  if (!client) return fail("Add your Google app (Client ID and secret) first: ask Baba \"connect my Gmail\" or use Integrations → Google app.");

  const nonce = newNonce();
  const state = signState({ workspaceId: ctx.workspace.id, userId: ctx.user.id, nonce, popup, returnTo, client: client.source });
  const response = NextResponse.redirect(authorizeUrl(publicOrigin(request), state, client));
  // Ties the Google callback to this browser
  response.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/google", maxAge: 600 });
  return response;
}
