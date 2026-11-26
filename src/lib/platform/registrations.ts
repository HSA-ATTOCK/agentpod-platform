import "server-only";
import { routes } from "@/config/routes";
import { sendEmail } from "@/lib/email/mailer";
import { registrationRequestEmail } from "@/lib/email/templates";
import { serverOrigin } from "@/lib/origin";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { notifyInApp, platformAdmins } from "./account";

/**
 * Tells the platform administrators (bell menu + email) that someone is waiting for
 * approval. Runs once per person: the first time they reach the waiting screen after
 * confirming their email. Safe to call repeatedly.
 */
export async function notifyAdminsOfRegistration(userId: string) {
  if (!isAdminConfigured()) return;
  const db = getSupabaseAdmin();
  // Claim the notification (only the first caller sends it)
  const { data: claimed } = await db
    .from("platform_accounts")
    .update({ admins_notified_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending_approval")
    .is("admins_notified_at", null)
    .select("user_id");
  if (!claimed?.length) return;

  const { data: profile } = await db.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  if (!profile) return;
  const admins = await platformAdmins();
  const link = `${routes.admin}/registrations`;
  await notifyInApp(
    admins.map((a) => ({
      userId: a.id,
      kind: "info" as const,
      title: "New registration waiting for approval",
      body: `${profile.full_name || profile.email} (${profile.email})`,
      link,
    })),
  );
  await Promise.all(
    admins.map((a) =>
      sendEmail(
        registrationRequestEmail({
          to: a.email,
          name: profile.full_name || profile.email,
          email: profile.email,
          url: `${serverOrigin()}${link}`,
        }),
      ),
    ),
  );
}
