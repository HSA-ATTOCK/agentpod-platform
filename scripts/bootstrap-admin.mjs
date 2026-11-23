// Makes an existing account a platform (master) administrator.
// Secure setup step: it needs the server's SUPABASE_SECRET_KEY, so only someone with
// access to the deployment's environment can run it. There is no public route for this.
//
// Usage:
//   npm run admin:bootstrap -- you@example.com          make admin (and approve the account)
//   npm run admin:bootstrap -- you@example.com --remove remove admin rights
//
// The person must have signed up first.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const remove = process.argv.includes("--remove");
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:bootstrap -- you@example.com [--remove]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: profile, error } = await db.from("profiles").select("id, email").ilike("email", email).maybeSingle();
if (error) {
  console.error("✗ Couldn't look up the account:", error.message);
  process.exit(1);
}
if (!profile) {
  console.error(`✗ No account with the email ${email}. Sign up in the app first, then run this again.`);
  process.exit(1);
}

const patch = remove ? { is_admin: false } : { is_admin: true, status: "approved", reviewed_at: new Date().toISOString() };
const { error: upsertError } = await db
  .from("platform_accounts")
  .upsert({ user_id: profile.id, ...patch }, { onConflict: "user_id" });
if (upsertError) {
  console.error("✗ Couldn't update the account:", upsertError.message);
  process.exit(1);
}

await db.from("audit_logs").insert({
  actor_email: "bootstrap-script",
  action: remove ? "admin.removed" : "admin.bootstrapped",
  target_type: "user",
  target_id: profile.id,
  details: { email: profile.email },
});

console.log(
  remove
    ? `✓ ${profile.email} is no longer a platform administrator.`
    : `✓ ${profile.email} is now a platform administrator. Open /admin in the app (sign out and in again if it was open).`,
);
