import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Supabase client with the SECRET key, for background jobs that run without a signed-in
 * user (scheduled workflows). It bypasses Row Level Security, so code using it must
 * scope every query to the right workspace itself. Never import this into browser code.
 */
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function isAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function getSupabaseAdmin() {
  if (!isAdminConfigured()) throw new Error("SUPABASE_SECRET_KEY isn't set.");
  adminClient ??= createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
