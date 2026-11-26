import { BillingError, createCheckout, isStripeConfigured } from "@/lib/billing/stripe";
import { canManage, getAppContext } from "@/lib/data/context";
import { publicOrigin } from "@/lib/origin";

/** POST /api/billing/checkout — body: { planId }. Returns { url } of a Stripe Checkout page. Owners and admins. */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can change the plan." }, { status: 403 });
  if (!isStripeConfigured()) return Response.json({ error: "Online payment isn't set up yet. Contact us to change plan." }, { status: 503 });
  const { planId } = (await request.json().catch(() => ({}))) as { planId?: string };
  if (typeof planId !== "string") return Response.json({ error: "Choose a plan." }, { status: 400 });
  try {
    const url = await createCheckout({ workspaceId: ctx.workspace.id, workspaceName: ctx.workspace.name, email: ctx.user.email, planId, origin: publicOrigin(request) });
    return Response.json({ url });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[billing/checkout]", error);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
