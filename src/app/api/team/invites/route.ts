import { routes } from "@/config/routes";
import { canManage, getAppContext } from "@/lib/data/context";
import { appOrigin, sendEmail } from "@/lib/email/mailer";
import { inviteEmail } from "@/lib/email/templates";
import { isValidEmail } from "@/lib/validation";

const ROLES = ["admin", "member", "viewer"] as const;
type InviteRole = (typeof ROLES)[number];

/**
 * POST /api/team/invites — body: { email, role }       → create an invite and email it
 * POST /api/team/invites — body: { resendId }           → email an existing pending invite again
 * Owners and admins only (the database's RLS rules check this too).
 */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) {
    return Response.json({ error: "Only owners and admins can invite people." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; role?: unknown; resendId?: unknown };
  let email: string;
  let role: InviteRole;

  if (typeof body.resendId === "string") {
    const { data: invite } = await ctx.supabase
      .from("workspace_invites")
      .select("email, role")
      .eq("id", body.resendId)
      .eq("workspace_id", ctx.workspace.id)
      .eq("status", "pending")
      .maybeSingle();
    if (!invite) return Response.json({ error: "That invite no longer exists." }, { status: 404 });
    email = invite.email;
    role = invite.role as InviteRole;
  } else {
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    role = ROLES.includes(body.role as InviteRole) ? (body.role as InviteRole) : "member";
    if (!isValidEmail(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

    const { error } = await ctx.supabase
      .from("workspace_invites")
      .insert({ workspace_id: ctx.workspace.id, email, role, invited_by: ctx.user.id });
    if (error) {
      const duplicate = error.code === "23505";
      return Response.json(
        { error: duplicate ? "There's already a pending invite for that email." : "Couldn't create the invite." },
        { status: duplicate ? 409 : 500 },
      );
    }
  }

  const url = `${appOrigin(request)}${routes.signUp}?email=${encodeURIComponent(email)}`;
  const emailSent = await sendEmail(
    inviteEmail({ to: email, workspaceName: ctx.workspace.name, inviterName: ctx.user.fullName, role, url }),
  );
  return Response.json({ ok: true, emailSent, url });
}
