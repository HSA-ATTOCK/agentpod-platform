import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { canManage, getAppContext } from "@/lib/data/context";
import { completeConnection, readState } from "@/lib/integrations/google/oauth";
import { publicOrigin, publicUrl } from "@/lib/origin";

const NONCE_COOKIE = "baba_google_oauth";

/** GET /api/integrations/google/callback — Google sends people back here after they allow access. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const done = (params: Record<string, string>) => {
    const target = publicUrl(request, routes.integrations);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    const response = NextResponse.redirect(target);
    response.cookies.delete({ name: NONCE_COOKIE, path: "/api/integrations/google" });
    return response;
  };

  if (url.searchParams.get("error")) {
    return done({ error: url.searchParams.get("error") === "access_denied" ? "Google access wasn't allowed." : "Google sign-in failed." });
  }

  const state = readState(url.searchParams.get("state"));
  const nonce = (await cookies()).get(NONCE_COOKIE)?.value;
  const ctx = await getAppContext();
  // The state must be ours, from this browser, for the workspace the person is in now
  if (!state || !nonce || state.nonce !== nonce || !ctx || ctx.user.id !== state.userId || ctx.workspace.id !== state.workspaceId) {
    return done({ error: "That sign-in link expired. Please click Connect again." });
  }
  if (!canManage(ctx.workspace.role)) return done({ error: "Only owners and admins can connect tools." });

  const code = url.searchParams.get("code");
  if (!code) return done({ error: "Google didn't send a sign-in code. Please try again." });

  try {
    const email = await completeConnection({ code, origin: publicOrigin(request), workspaceId: state.workspaceId, userId: state.userId });
    return done({ connected: "google", ...(email ? { account: email } : {}) });
  } catch (error) {
    console.error("[integrations/google]", error);
    return done({ error: error instanceof Error ? error.message : "Couldn't connect Google." });
  }
}
