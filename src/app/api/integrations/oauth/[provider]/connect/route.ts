import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { safeNext } from "@/lib/auth/safe-next";
import { canManage, getAppContext } from "@/lib/data/context";
import { newNonce, signState } from "@/lib/integrations/google/oauth";
import { cleanShop, isOAuthProvider, oauthAuthorizeUrl, oauthClientFor, PROVIDERS } from "@/lib/integrations/oauth-apps";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { popupResult } from "../../../google/popup-result";

/** GET /api/integrations/oauth/<provider>/connect — starts the sign-in (owners and admins). ?popup=1 from the chat. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const popup = url.searchParams.get("popup") === "1";
  const returnTo = safeNext(url.searchParams.get("return"), routes.integrations);
  const fail = (message: string) => {
    if (popup) return popupResult(request, { ok: false, error: message }, provider);
    const target = publicUrl(request, returnTo);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  };
  if (!isOAuthProvider(provider)) return fail("Unknown service.");
  const ctx = await getAppContext();
  if (!ctx) return popup ? fail("Please sign in to Baba first.") : NextResponse.redirect(publicUrl(request, routes.signIn));
  if (!canManage(ctx.workspace.role)) return fail("Only owners and admins can connect tools.");
  if (!isAdminConfigured()) return fail("Connections can't be stored securely on this server yet.");
  const client = await oauthClientFor(ctx.workspace.id, provider);
  if (!client) return fail(`Set up this workspace's ${PROVIDERS[provider].name} app first (Integrations, or ask Baba).`);

  // Shopify signs in per store
  const shop = PROVIDERS[provider].perShop ? cleanShop(url.searchParams.get("shop") ?? "") : undefined;
  if (PROVIDERS[provider].perShop && !shop) return fail("Enter your store address, e.g. your-store.myshopify.com.");

  const nonce = newNonce();
  const state = signState({ workspaceId: ctx.workspace.id, userId: ctx.user.id, nonce, popup, returnTo, provider, shop } as Parameters<typeof signState>[0]);
  const response = NextResponse.redirect(oauthAuthorizeUrl(publicOrigin(request), provider, state, client, shop ?? undefined));
  response.cookies.set(`baba_${provider}_oauth`, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: `/api/integrations/oauth/${provider}`, maxAge: 600 });
  return response;
}
