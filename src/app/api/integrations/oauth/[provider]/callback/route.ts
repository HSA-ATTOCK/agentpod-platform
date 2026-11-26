import { NextResponse } from "next/server";
import { readState } from "@/lib/integrations/google/oauth";
import { cleanShop, completeOAuthConnection, isOAuthProvider, oauthClientFor, PROVIDERS, verifyShopifyHmac } from "@/lib/integrations/oauth-apps";
import { canManage, getAppContext } from "@/lib/data/context";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { audit } from "@/lib/platform/account";
import { popupResult } from "../../../google/popup-result";

/** GET /api/integrations/oauth/<provider>/callback — the provider sends people back here after they approve. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const state = readState(url.searchParams.get("state")) as (ReturnType<typeof readState> & { provider?: string; shop?: string }) | null;
  const popup = Boolean(state?.popup);
  const back = (result: { ok: true; account: string } | { ok: false; error: string }) => {
    const response = popup
      ? popupResult(request, result, provider)
      : NextResponse.redirect(
          (() => {
            const target = publicUrl(request, state?.returnTo ?? "/integrations");
            if (result.ok) target.searchParams.set("connected", provider);
            else target.searchParams.set("error", result.error);
            return target;
          })(),
        );
    // The one-time sign-in cookie is no longer needed
    response.headers.append("Set-Cookie", `baba_${provider}_oauth=; Path=/api/integrations/oauth/${provider}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return response;
  };

  if (!isOAuthProvider(provider) || !state || state.provider !== provider) return back({ ok: false, error: "That sign-in link isn't valid. Please try again." });
  const cookie = request.headers.get("cookie")?.match(new RegExp(`baba_${provider}_oauth=([^;]+)`))?.[1];
  if (!cookie || cookie !== state.nonce) return back({ ok: false, error: "The sign-in expired or was started in another browser. Please try again." });
  const ctx = await getAppContext();
  if (!ctx || ctx.user.id !== state.userId || ctx.workspace.id !== state.workspaceId) {
    return back({ ok: false, error: "Please finish the sign-in in the same Baba account and workspace." });
  }
  if (!canManage(ctx.workspace.role)) return back({ ok: false, error: "Only owners and admins can connect tools." });
  const denied = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (denied || !code) return back({ ok: false, error: `${PROVIDERS[provider].name} sign-in was cancelled.` });
  const extra: Record<string, string> = {};
  if (provider === "quickbooks") {
    const realmId = url.searchParams.get("realmId") ?? "";
    if (!/^\d{1,32}$/.test(realmId)) return back({ ok: false, error: "QuickBooks didn't say which company to connect. Please try again." });
    extra.realmId = realmId;
  }
  if (provider === "shopify") {
    // The store must be the one the sign-in started with, and Shopify's signature must match
    const shop = cleanShop(url.searchParams.get("shop") ?? "");
    const client = await oauthClientFor(state.workspaceId, "shopify");
    if (!shop || shop !== state.shop || !client || !verifyShopifyHmac(url.searchParams, client.secret)) {
      return back({ ok: false, error: "Shopify's reply couldn't be verified. Please try again." });
    }
    extra.shop = shop;
  }
  try {
    const account = await completeOAuthConnection({ provider, code, origin: publicOrigin(request), workspaceId: state.workspaceId, userId: state.userId, extra });
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "integration.connected", targetType: provider, details: { account } });
    return back({ ok: true, account });
  } catch (error) {
    return back({ ok: false, error: error instanceof Error ? error.message : "The connection failed." });
  }
}
