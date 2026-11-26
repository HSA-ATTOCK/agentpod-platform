import { NextResponse } from "next/server";
import { readState } from "@/lib/integrations/google/oauth";
import { completeOAuthConnection, isOAuthProvider, PROVIDERS } from "@/lib/integrations/oauth-apps";
import { getAppContext } from "@/lib/data/context";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { audit } from "@/lib/platform/account";
import { popupResult } from "../../../google/popup-result";

/** GET /api/integrations/oauth/<provider>/callback — the provider sends people back here after they approve. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const state = readState(url.searchParams.get("state")) as (ReturnType<typeof readState> & { provider?: string }) | null;
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
  const denied = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (denied || !code) return back({ ok: false, error: `${PROVIDERS[provider].name} sign-in was cancelled.` });
  try {
    const account = await completeOAuthConnection({ provider, code, origin: publicOrigin(request), workspaceId: state.workspaceId, userId: state.userId });
    await audit({ actorId: ctx.user.id, actorEmail: ctx.user.email, workspaceId: ctx.workspace.id, action: "integration.connected", targetType: provider, details: { account } });
    return back({ ok: true, account });
  } catch (error) {
    return back({ ok: false, error: error instanceof Error ? error.message : "The connection failed." });
  }
}
