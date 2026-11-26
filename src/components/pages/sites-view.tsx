"use client";

import { ExternalLink, Globe, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";

export type SiteRow = {
  id: string;
  name: string;
  url: string;
  status: string;
  currentVersion: number | null;
  expiresAt: string;
  expired: boolean;
  conversationId: string | null;
  productionUrl: string | null;
  productionVersion: number | null;
  customDomain: string | null;
  versions: { version: number; note: string | null; createdAt: string; fileCount: number }[];
};

export function SitesView({ sites, canManage, productionAvailable }: { sites: SiteRow[]; canManage: boolean; productionAvailable: boolean }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "That didn't work.");
      if (data.message) window.alert(data.message);
      showToast(done);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  if (sites.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No websites yet"
        description="Ask Baba to build one, e.g. “Build a website for my dental clinic with services, team and contact pages.” You'll get a preview link."
        action={<ButtonLink href={routes.ask}>Ask Baba</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {toast}
      {error && <Alert variant="error">{error}</Alert>}
      {sites.map((s) => {
        const expired = s.expired;
        return (
          <Card key={s.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{s.name}</h2>
                  {s.status === "disabled" ? <Badge tone="neutral">Switched off</Badge> : expired ? <Badge tone="warning">Expired</Badge> : <Badge tone="success">Preview live</Badge>}
                  <Badge>Version {s.currentVersion ?? "—"}</Badge>
                </div>
                <p className="mt-1 break-all text-xs text-muted">{s.url}</p>
                <p className="text-[11px] text-subtle">
                  Preview link works until <LocalTime iso={s.expiresAt} format="date" /> (publishing again extends it).
                </p>
                {s.productionUrl && (
                  <p className="mt-1 text-xs text-success">
                    Live (version {s.productionVersion}):{" "}
                    <a href={s.productionUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {s.productionUrl}
                    </a>
                    {s.customDomain && <span className="text-muted"> · domain requested: {s.customDomain}</span>}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {s.status !== "disabled" && !expired && (
                  <ButtonLink href={s.url} target="_blank" rel="noopener noreferrer" size="sm">
                    <ExternalLink aria-hidden="true" className="size-3.5" /> Open preview
                  </ButtonLink>
                )}
                {s.conversationId && (
                  <ButtonLink href={`${routes.ask}?c=${s.conversationId}`} size="sm" variant="secondary">
                    Request changes
                  </ButtonLink>
                )}
                {canManage && productionAvailable && s.currentVersion !== null && (
                  <Button
                    size="sm"
                    loading={busy === `pub-${s.id}`}
                    onClick={() => {
                      if (window.confirm(`Publish version ${s.currentVersion} of "${s.name}" to its live address? Anyone on the internet will be able to see it.`)) {
                        void act(`pub-${s.id}`, { action: "publish", siteId: s.id }, "Published live.");
                      }
                    }}
                  >
                    {s.productionUrl ? "Update live site" : "Publish live"}
                  </Button>
                )}
                {canManage && productionAvailable && s.productionUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === `dom-${s.id}`}
                    onClick={() => {
                      const domain = window.prompt("Your domain for this site (e.g. www.example.com):", s.customDomain ?? "");
                      if (domain) void act(`dom-${s.id}`, { action: "domain", siteId: s.id, domain }, "Domain saved.");
                    }}
                  >
                    Use my domain
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" loading={busy === `st-${s.id}`} onClick={() => act(`st-${s.id}`, { action: s.status === "disabled" ? "enable" : "disable", siteId: s.id }, "Updated.")}>
                      {s.status === "disabled" ? "Switch on" : "Switch off"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      loading={busy === `del-${s.id}`}
                      onClick={() => {
                        if (window.confirm(`Delete "${s.name}" and all its versions? The preview link stops working.`)) void act(`del-${s.id}`, { action: "delete", siteId: s.id }, "Website deleted.");
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
            <details className="rounded-control border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm text-muted">Version history ({s.versions.length})</summary>
              <ul className="divide-y divide-border">
                {s.versions.map((v) => (
                  <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-foreground">
                      Version {v.version} <span className="text-xs text-muted">· {v.fileCount} files · <LocalTime iso={v.createdAt} /></span>
                      {v.note && <span className="block text-xs text-muted">{v.note}</span>}
                    </span>
                    {v.version === s.currentVersion ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      canManage && (
                        <Button size="sm" variant="secondary" loading={busy === `v-${s.id}-${v.version}`} onClick={() => act(`v-${s.id}-${v.version}`, { action: "restore", siteId: s.id, version: v.version }, `Version ${v.version} is live again.`)}>
                          <RotateCcw aria-hidden="true" className="size-3.5" /> Restore
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
