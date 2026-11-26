import { BillingError, createPortal, isStripeConfigured } from "@/lib/billing/stripe";
import { canManage, getAppContext } from "@/lib/data/context";
import { publicOrigin } from "@/lib/origin";

/** POST /api/billing/portal — returns { url } of Stripe's billing portal (card, invoices, cancel). Owners and admins. */
export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canManage(ctx.workspace.role)) return Response.json({ error: "Only owners and admins can manage billing." }, { status: 403 });
  if (!isStripeConfigured()) return Response.json({ error: "Online payment isn't set up yet." }, { status: 503 });
  try {
    return Response.json({ url: await createPortal({ workspaceId: ctx.workspace.id, origin: publicOrigin(request) }) });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[billing/portal]", error);
    return Response.json({ error: "Couldn't open billing. Please try again." }, { status: 502 });
  }
}
