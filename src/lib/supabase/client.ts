"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Supabase client for the browser. Every query runs as the signed-in user, limited by RLS. */
export function getSupabaseBrowser() {
  if (!browserClient) {
    const { url, key } = supabaseEnv();
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}
