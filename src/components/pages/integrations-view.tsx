"use client";

import { Check, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { integrationCatalog, type Integration, type IntegrationCategory } from "@/config/integrations";
import { cn } from "@/lib/utils";

type Filter = "all" | IntegrationCategory;

const categories: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "communication", label: "Communication" },
  { value: "files", label: "Files" },
  { value: "crm", label: "CRM" },
  { value: "productivity", label: "Productivity" },
  { value: "developer", label: "Developer" },
];

/** First-letter placeholder instead of real brand logos. */
function Monogram({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 items-center justify-center rounded-control border border-border bg-surface-raised text-sm font-bold",
        muted ? "text-subtle" : "text-foreground",
      )}
    >
      {name[0]}
    </span>
  );
}

export function IntegrationsView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<Integration | null>(null);

  const q = query.trim().toLowerCase();
  const shown = integrationCatalog.filter(
    (i) => (filter === "all" || i.category === filter) && (!q || i.name.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Choose which tools Baba is allowed to use. Baba only uses what you connect."
      />

      <Card className="flex items-start gap-3.5 p-4 sm:p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-warning/10 text-warning">
          <ShieldCheck aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sensitive actions need your approval</h2>
          <p className="mt-0.5 text-xs text-muted">
            Connected tools let Baba read and prepare work. It always asks before sending messages, changing records or
            spending money.
          </p>
        </div>
      </Card>

      <section className="space-y-4" aria-label="Integrations">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <label htmlFor="integration-search" className="sr-only">Search integrations</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              id="integration-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search integrations…"
              className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <FilterTabs label="Filter by category" value={filter} onChange={setFilter} options={categories} />
        </div>

        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No integrations match your search.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((integration) => (
              <li key={integration.id}>
                <Card className={cn("flex h-full flex-col justify-between p-5", integration.comingSoon && "opacity-75")}>
                  <div>
                    <div className="flex items-center justify-between">
                      <Monogram name={integration.name} muted={integration.comingSoon} />
                      <Badge tone="neutral">{integration.comingSoon ? "Coming soon" : "Not connected"}</Badge>
                    </div>
                    <h3 className="mt-3 text-sm font-medium text-foreground">{integration.name}</h3>
                    <p className="mt-1 text-xs text-muted">{integration.description}</p>
                  </div>
                  <div className="mt-5 flex justify-end border-t border-border pt-4">
                    {integration.comingSoon ? (
                      <Button size="sm" variant="secondary" disabled>
                        Coming soon
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setConnecting(integration);
                        }}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        side="center"
        title={connecting ? `Connect ${connecting.name}` : "Connect"}
        footer={
          connecting && (
            <>
              <Button variant="secondary" onClick={() => setConnecting(null)}>
                Cancel
              </Button>
              <Button disabled title="Coming soon">Connect {connecting.name}</Button>
            </>
          )
        }
      >
        {connecting && (
          <div className="space-y-4 p-4 text-sm">
            <div>
              <h3 className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Check aria-hidden="true" className="size-4 text-success" /> What Baba will be able to do
              </h3>
              <ul className="list-disc space-y-1 pl-9 text-muted">
                {connecting.canDo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-control border border-border bg-surface-raised p-3.5">
              <h3 className="mb-2 flex items-center gap-2 font-medium text-warning">
                <TriangleAlert aria-hidden="true" className="size-4" /> Always needs your approval
              </h3>
              <ul className="list-disc space-y-1 pl-9 text-muted">
                {connecting.needsApproval.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <Alert variant="info">
              Connecting tools is coming in the next update. This is exactly what Baba will be able to do once it&apos;s
              switched on.
            </Alert>
          </div>
        )}
      </Sheet>
    </div>
  );
}
