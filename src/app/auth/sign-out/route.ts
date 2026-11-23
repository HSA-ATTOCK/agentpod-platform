import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { publicUrl } from "@/lib/origin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST /auth/sign-out — ends the session and returns to the sign-in page. */
export async function POST(request: Request) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(publicUrl(request, routes.signIn), { status: 303 });
}
