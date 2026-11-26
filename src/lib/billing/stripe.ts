import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { audit, notifyInApp } from "@/lib/platform/account";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Stripe billing (PRD §16), using Stripe's REST API directly.
 * Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET; without them billing stays off and
 * plans are assigned by the platform admin. Prices live in Stripe and on each plan
 * (stripe_price_id), never in code.
 */

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export class BillingError extends Error {}

/** Encodes nested params the way Stripe expects (a[b]=c, items[0][price]=…). */
export function formEncode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((v, i) => out.push(...(typeof v === "object" ? formEncode(v as Record<string, unknown>, `${name}[${i}]`) : [`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`])));
    else if (typeof value === "object") out.push(...formEncode(value as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return out;
}

async function stripe<T>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingError("Online payment isn't set up yet.");
  const body = formEncode(params).join("&");
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new BillingError(data.error?.message ?? `Stripe error (${res.status}).`);
  return data;
}

// ---------------------------------------------------------------------------
// Checkout and the customer portal
// ---------------------------------------------------------------------------

async function customerFor(workspaceId: string, workspaceName: string, email: string) {
  const db = getSupabaseAdmin();
  const { data } = await db.from("workspace_billing").select("stripe_customer_id").eq("workspace_id", workspaceId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await stripe<{ id: string }>(
    "POST",
    "/customers",
    { name: workspaceName, email, metadata: { workspace_id: workspaceId } },
    `customer-${workspaceId}`,
  );
  await db.from("workspace_billing").upsert({ workspace_id: workspaceId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() });
  return customer.id;
}

export async function createCheckout(input: { workspaceId: string; workspaceName: string; email: string; planId: string; origin: string }) {
  const db = getSupabaseAdmin();
  const { data: plan } = await db.from("subscription_plans").select("id, name, stripe_price_id, active, is_public").eq("id", input.planId).maybeSingle();
  if (!plan?.active || !plan.is_public || !plan.stripe_price_id) throw new BillingError("That plan can't be bought online.");
  const customer = await customerFor(input.workspaceId, input.workspaceName, input.email);
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${input.origin}/usage?billing=success`,
    cancel_url: `${input.origin}/usage?billing=cancelled`,
    client_reference_id: input.workspaceId,
    allow_promotion_codes: true,
    metadata: { workspace_id: input.workspaceId, plan_id: plan.id },
    subscription_data: { metadata: { workspace_id: input.workspaceId, plan_id: plan.id } },
  });
  return session.url;
}

export async function createPortal(input: { workspaceId: string; origin: string }) {
  const { data } = await getSupabaseAdmin().from("workspace_billing").select("stripe_customer_id").eq("workspace_id", input.workspaceId).maybeSingle();
  if (!data?.stripe_customer_id) throw new BillingError("This workspace has no billing account yet. Choose a plan first.");
  const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer: data.stripe_customer_id, return_url: `${input.origin}/usage` });
  return session.url;
}

export type Invoice = { id: string; number: string | null; amountCents: number; currency: string; status: string; created: string; url: string | null };

export async function listInvoices(workspaceId: string): Promise<Invoice[]> {
  if (!isStripeConfigured()) return [];
  const { data } = await getSupabaseAdmin().from("workspace_billing").select("stripe_customer_id").eq("workspace_id", workspaceId).maybeSingle();
  if (!data?.stripe_customer_id) return [];
  try {
    const list = await stripe<{ data: { id: string; number: string | null; amount_due: number; currency: string; status: string; created: number; hosted_invoice_url: string | null }[] }>(
      "GET",
      "/invoices",
      { customer: data.stripe_customer_id, limit: 12 },
    );
    return list.data.map((i) => ({
      id: i.id,
      number: i.number,
      amountCents: i.amount_due,
      currency: i.currency,
      status: i.status,
      created: new Date(i.created * 1000).toISOString(),
      url: i.hosted_invoice_url,
    }));
  } catch (error) {
    console.error("[billing] invoices:", error instanceof Error ? error.message : error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** Checks Stripe's signature header (t=…,v1=…) against the raw body. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds || signatures.length === 0) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

type Subscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
  metadata: Record<string, string>;
};

/** Brings a workspace's plan and limits in line with its Stripe subscription. */
async function applySubscription(sub: Subscription, deleted = false) {
  const db = getSupabaseAdmin();
  let workspaceId: string | undefined = sub.metadata?.workspace_id;
  if (!workspaceId) {
    const { data } = await db.from("workspace_billing").select("workspace_id").eq("stripe_customer_id", sub.customer).maybeSingle();
    workspaceId = data?.workspace_id;
  }
  if (!workspaceId) return;
  const priceId = sub.items.data[0]?.price.id;
  const { data: plan } = priceId ? await db.from("subscription_plans").select("id, name").eq("stripe_price_id", priceId).maybeSingle() : { data: null };
  const active = !deleted && ["active", "trialing", "past_due"].includes(sub.status);
  const periodEnd = sub.current_period_end ?? sub.items.data[0]?.current_period_end;

  await db.from("workspace_billing").upsert({
    workspace_id: workspaceId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: deleted ? "canceled" : sub.status,
    plan_id: active ? (plan?.id ?? null) : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  // The plan sets the workspace's limits (the admin's overrides stay as they are)
  await db.from("workspace_limits").upsert(
    { workspace_id: workspaceId, plan_id: active ? (plan?.id ?? null) : null, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id" },
  );
  await audit({ actorEmail: "stripe", workspaceId, action: active ? "billing.subscription_active" : "billing.subscription_ended", targetType: "workspace", targetId: workspaceId, details: { status: sub.status, plan: plan?.name ?? null } });
}

async function notifyManagers(workspaceId: string, title: string, body: string, kind: "success" | "warning" | "danger") {
  const db = getSupabaseAdmin();
  const { data } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("role", ["owner", "admin"]);
  await notifyInApp((data ?? []).map((m) => ({ userId: m.user_id, workspaceId, kind, title, body, link: "/usage" })));
}

/**
 * Handles one verified Stripe event. Returns false if it was already handled.
 * The event is recorded only after it was applied (a failure makes Stripe retry), and
 * subscriptions are always re-read from Stripe, so late or out-of-order events can't
 * bring back an old state.
 */
export async function handleStripeEvent(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  const db = getSupabaseAdmin();
  const { data: seen } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return false;
  const object = event.data.object;
  const latest = async (id: string) => {
    try {
      return { sub: await stripe<Subscription>("GET", `/subscriptions/${id}`), deleted: false };
    } catch (error) {
      // A deleted subscription can't be fetched any more: use the event's copy, marked as ended
      if (error instanceof BillingError) return { sub: object as unknown as Subscription, deleted: true };
      throw error;
    }
  };
  switch (event.type) {
    case "checkout.session.completed": {
      const subscriptionId = object.subscription as string | undefined;
      if (subscriptionId) {
        const { sub, deleted } = await latest(subscriptionId);
        await applySubscription(sub, deleted || sub.status === "canceled");
        const workspaceId = (object.metadata as Record<string, string> | undefined)?.workspace_id;
        if (workspaceId) await notifyManagers(workspaceId, "Subscription started", "Thanks! Your new plan and limits are active.", "success");
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const { sub, deleted } = await latest(String(object.id));
      await applySubscription(sub, deleted || event.type === "customer.subscription.deleted" || sub.status === "canceled");
      break;
    }
    case "invoice.payment_failed": {
      const { data } = await db.from("workspace_billing").select("workspace_id").eq("stripe_customer_id", object.customer as string).maybeSingle();
      if (data) await notifyManagers(data.workspace_id, "Payment failed", "Stripe couldn't take the payment for your plan. Update your card under Usage & billing → Manage billing.", "danger");
      break;
    }
    default:
      break;
  }
  // Only now: a crash above leaves it unrecorded, so Stripe's retry is processed
  const { error: dupe } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  return !dupe;
}
