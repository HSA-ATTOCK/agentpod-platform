import { NextResponse, type NextRequest } from "next/server";
import { routes } from "@/config/routes";
import { publicUrl } from "@/lib/origin";
import { refreshSession } from "@/lib/supabase/proxy";

// Pages that need a signed-in user
const PROTECTED = [
  routes.ask,
  routes.dashboard,
  routes.agents,
  routes.workflows,
  routes.projects,
  routes.integrations,
  routes.activity,
  routes.settings,
  routes.profile,
  routes.resetPassword,
  routes.twoFactor,
];

// Pages a signed-in user doesn't need (sent on to the app instead)
const GUEST_ONLY = [routes.signIn, routes.signUp];

const matches = (path: string, list: readonly string[]) =>
  list.some((route) => path === route || path.startsWith(`${route}/`));

/**
 * Runs before every page: keeps the Supabase session fresh and
 * redirects people who aren't signed in away from the app.
 * The pages and API routes check the user again themselves — this is only the first gate.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await refreshSession(request);
  const path = request.nextUrl.pathname;

  if (!userId && matches(path, PROTECTED)) {
    const url = publicUrl(request, routes.signIn);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (userId && matches(path, GUEST_ONLY)) {
    return NextResponse.redirect(publicUrl(request, routes.ask));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
