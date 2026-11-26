import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingButton } from "@/components/pages/billing-actions";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/ui/local-time";
import { isStripeConfigured, listInvoices } from "@/lib/billing/stripe";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { formatCents } from "@/lib/format";
import { canManage, requireAppContext } from "@/lib/data/context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage & billing" };

function Meter({ label, used, limit, money = false }: { label: string; used: number; limit: number | null; money?: boolean }) {
  const fmt = (n: number) => (money ? formatCents(n) : String(n));
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-foreground">
          {fmt(used)} <span className="text-subtle">/ {limit === null ? "no limit" : fmt(limit)}</span>
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

async function PageContent({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const ws = ctx.workspace;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: tasks }, { count: workflows }, { count: connections }, { count: sites }, { data: members }, { data: plans }, { data: billing }, invoices] = await Promise.all([
    ctx.supabase.from("tasks").select("cost_cents, started_at, created_by, request").eq("workspace_id", ws.id).gte("started_at", monthStart.toISOString()),
    ctx.supabase.from("workflows").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
    ctx.supabase.from("integrations").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).neq("provider", "google_app"),
    ctx.supabase.from("sites").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).neq("status", "disabled"),
    ctx.supabase.from("workspace_members").select("user_id").eq("workspace_id", ws.id),
    ctx.supabase.from("subscription_plans").select("id, name, description, price_label, features, is_public, stripe_price_id").eq("is_public", true).order("sort"),
    ctx.supabase.from("workspace_billing").select("status, current_period_end, cancel_at_period_end, stripe_customer_id").eq("workspace_id", ws.id).maybeSingle(),
    listInvoices(ws.id),
  ]);
  const t = tasks ?? [];
  const monthCents = t.reduce((s, x) => s + x.cost_cents, 0);
  const todayCents = t.filter((x) => x.started_at >= todayStart.toISOString()).reduce((s, x) => s + x.cost_cents, 0);
  const limitCents = Math.round(ws.monthlyLimitUsd * 100);
  const byPerson = new Map<string, number>();
  for (const x of t) if (x.created_by) byPerson.set(x.created_by, (byPerson.get(x.created_by) ?? 0) + x.cost_cents);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const nameOf = (id: string) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? p.full_name || p.email : "Former member";
  };
  const days = new Map<string, number>();
  for (let d = new Date(monthStart); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) days.set(d.toISOString().slice(0, 10), 0);
  for (const x of t) days.set(x.started_at.slice(0, 10), (days.get(x.started_at.slice(0, 10)) ?? 0) + x.cost_cents);
  const maxDay = Math.max(1, ...days.values());

  const stripe = isStripeConfigured();
  const manager = canManage(ws.role);
  return (
    <div className="space-y-6">
      {params.billing === "success" && <Alert variant="success">Payment received. Your plan updates within a minute (refresh if it hasn&apos;t yet).</Alert>}
      {params.billing === "cancelled" && <Alert variant="info">Checkout was cancelled. Nothing was charged.</Alert>}
      {billing?.status && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">Subscription: {billing.status === "active" || billing.status === "trialing" ? "active" : billing.status.replace(/_/g, " ")}</p>
            {billing.current_period_end && (
              <p className="text-xs text-muted">
                {billing.cancel_at_period_end ? "Ends" : "Renews"} on <LocalTime iso={billing.current_period_end} format="date" />
              </p>
            )}
          </div>
          {stripe && manager && billing.stripe_customer_id && <BillingButton kind="portal" label="Manage billing" variant="secondary" />}
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-xs text-muted">Plan</p>
            <p className="text-lg font-semibold text-foreground">{ws.limits.planName ?? "Early access (no plan)"}</p>
          </div>
          <Meter label="AI spend this month" used={monthCents} limit={limitCents} money />
          <Meter label="AI spend today" used={todayCents} limit={ws.dailyLimitUsd === null ? null : Math.round(ws.dailyLimitUsd * 100)} money />
          <p className="text-xs text-muted">
            Remaining this month: <span className="font-medium text-foreground">{formatCents(Math.max(0, limitCents - monthCents))}</span> · Max per conversation: $
            {ws.taskCapUsd.toFixed(2)}. Limits reset on the 1st (UTC). You get a warning at 80%.
          </p>
        </Card>
        <Card className="space-y-4 p-5">
          <p className="text-sm font-medium text-foreground">Plan allowances</p>
          <Meter label="Workflows" used={workflows ?? 0} limit={ws.limits.maxWorkflows} />
          <Meter label="Connections" used={connections ?? 0} limit={ws.limits.maxIntegrations} />
          <Meter label="Website previews" used={sites ?? 0} limit={ws.limits.maxPreviews} />
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Daily spend this month</p>
        <div className="flex h-28 items-end gap-1" role="img" aria-label="Daily AI spend this month">
          {[...days.entries()].map(([day, cents]) => (
            <div key={day} className="flex-1" title={`${day}: ${formatCents(cents)}`}>
              <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(2, (cents / maxDay) * 104)}px` }} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-foreground">By person (this month)</p>
          {byPerson.size === 0 ? (
            <p className="text-sm text-subtle">No usage yet this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...byPerson.entries()].sort((a, b) => b[1] - a[1]).map(([id, cents]) => (
                <li key={id} className="flex justify-between gap-3">
                  <span className="truncate text-muted">{nameOf(id)}</span>
                  <span className="text-foreground">{formatCents(cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Most expensive tasks (this month)</p>
          {t.length === 0 ? (
            <p className="text-sm text-subtle">No tasks yet this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...t].sort((a, b) => b.cost_cents - a.cost_cents).slice(0, 6).map((x, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-muted">{x.request}</span>
                  <span className="shrink-0 text-foreground">{formatCents(x.cost_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {(plans ?? []).length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Plans</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(plans ?? []).map((p) => (
              <Card key={p.id} className={cn("space-y-2 p-4", p.name === ws.limits.planName && "border-accent")}>
                <p className="font-semibold text-foreground">{p.name}</p>
                <p className="text-xs text-muted">{p.price_label || "Price on request"}</p>
                <ul className="space-y-1 text-xs text-muted">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                {stripe && manager && p.stripe_price_id && p.name !== ws.limits.planName && (
                  <BillingButton kind={billing?.stripe_customer_id && billing.status === "active" ? "portal" : "checkout"} planId={p.id} label={billing?.status === "active" ? "Switch plan" : "Choose plan"} />
                )}
              </Card>
            ))}
          </div>
          {!stripe && <p className="text-xs text-subtle">To change plan, contact us (online payment isn&apos;t available yet).</p>}
          {stripe && !manager && <p className="text-xs text-subtle">Only owners and admins can change the plan.</p>}
        </div>
      )}

      {invoices.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Invoices</p>
          <ul className="divide-y divide-border text-sm">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-muted">
                  {inv.number ?? inv.id} · <LocalTime iso={inv.created} format="date" />
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-foreground">
                    {(inv.amountCents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                  </span>
                  <span className="text-xs text-subtle">{inv.status}</span>
                  {inv.url && (
                    <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">
                      View
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function Page(props: { searchParams: Promise<{ billing?: string }> }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Usage & billing" description="What this workspace spends on Baba, against its limits." />
      <Suspense fallback={<PageSkeleton />}>
        <PageContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
