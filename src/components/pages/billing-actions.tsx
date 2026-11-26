"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function go(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "That didn't work.");
  // Stripe's own pages (Checkout / billing portal)
  window.location.href = data.url;
}

/** "Choose plan" (Stripe Checkout) or "Manage billing" (Stripe portal). */
export function BillingButton({ kind, planId, label, variant = "primary" }: { kind: "checkout" | "portal"; planId?: string; label: string; variant?: "primary" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant={variant}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await go(kind === "checkout" ? "/api/billing/checkout" : "/api/billing/portal", { planId });
          } catch (e) {
            setError(e instanceof Error ? e.message : "That didn't work.");
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
