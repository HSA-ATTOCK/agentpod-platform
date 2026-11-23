import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { safeNext } from "@/lib/auth/safe-next";
import { canManage, getAppContext } from "@/lib/data/context";
import { completeConnection, readState } from "@/lib/integrations/google/oauth";
import { publicOrigin, publicUrl } from "@/lib/origin";
import { popupResult } from "../popup-result";

const NONCE_COOKIE = "baba_google_oauth";

/** GET /api/integrations/google/callback — Google sends people back here after they allow access. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = readState(url.searchParams.get("state"));

  const done = (result: { ok: true; account: string } | { ok: false; error: string }) => {
    const response = state?.popup
      ? popupResult(request, result)
      : (() => {
          const target = publicUrl(request, safeNext(state?.returnTo, routes.integrations));
          if (result.ok) {
            target.searchParams.set("connected", "google");
            target.searchParams.set("account", result.account);
          } else {
            target.searchParams.set("error", result.error);
          }
          return NextResponse.redirect(target);
        })();
    // NextResponse and Response both carry cookies through headers
    response.headers.append("Set-Cookie", `${NONCE_COOKIE}=; Path=/api/integrations/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return response;
  };

  if (url.searchParams.get("error")) {
    return done({ ok: false, error: url.searchParams.get("error") === "access_denied" ? "Google access wasn't allowed." : "Google sign-in failed." });
  }

  const nonce = (await cookies()).get(NONCE_COOKIE)?.value;
  const ctx = await getAppContext();
  // The state must be ours, from this browser, for the workspace the person is in now
  if (!state || !nonce || state.nonce !== nonce || !ctx || ctx.user.id !== state.userId || ctx.workspace.id !== state.workspaceId) {
    return done({ ok: false, error: "That sign-in link expired. Please click Connect again." });
  }
  if (!canManage(ctx.workspace.role)) return done({ ok: false, error: "Only owners and admins can connect tools." });

  const code = url.searchParams.get("code");
  if (!code) return done({ ok: false, error: "Google didn't send a sign-in code. Please try again." });

  try {
    const account = await completeConnection({ code, origin: publicOrigin(request), workspaceId: state.workspaceId, userId: state.userId });
    return done({ ok: true, account });
  } catch (error) {
    console.error("[integrations/google]", error);
    return done({ ok: false, error: error instanceof Error ? error.message : "Couldn't connect Google." });
  }
}
