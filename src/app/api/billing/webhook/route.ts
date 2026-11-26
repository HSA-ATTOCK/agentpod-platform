import { handleStripeEvent, verifyStripeSignature } from "@/lib/billing/stripe";
import { isAdminConfigured } from "@/lib/supabase/admin";

/**
 * POST /api/billing/webhook — Stripe sends subscription and invoice events here.
 * In Stripe: Developers → Webhooks → add https://<your-domain>/api/billing/webhook with the events
 * checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed.
 * Every request is checked with STRIPE_WEBHOOK_SECRET; repeated events are ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !isAdminConfigured()) return Response.json({ error: "Billing isn't configured." }, { status: 503 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
    const handled = await handleStripeEvent(event);
    return Response.json({ received: true, duplicate: !handled });
  } catch (error) {
    console.error("[billing/webhook]", error);
    // A 500 makes Stripe retry later
    return Response.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
