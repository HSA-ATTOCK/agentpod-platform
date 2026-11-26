"use client";

import { CircleCheck, KeyRound, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

export type NativeService = {
  key: "slack" | "hubspot" | "microsoft";
  name: string;
  what: string;
  appClientId: string | null;
  accounts: { id: string; label: string; isDefault: boolean; status: string }[];
  redirectUri: string;
  consoleUrl: string;
  steps: string[];
};

/** Slack, HubSpot and Microsoft 365 on the Integrations page. */
export function NativeIntegrations({ services, canManage, available }: { services: NativeService[]; canManage: boolean; available: boolean }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [setup, setSetup] = useState<NativeService | null>(null);
  const [form, setForm] = useState({ clientId: "", secret: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function post(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "That didn't work.");
  }

  async function saveApp(event: FormEvent) {
    event.preventDefault();
    if (!setup) return;
    setBusy("app");
    setError(null);
    try {
      await post(`/api/integrations/oauth/${setup.key}/app`, "POST", { clientId: form.clientId.trim(), clientSecret: form.secret.trim() });
      showToast(`${setup.name} app saved. Click Connect.`);
      setSetup(null);
      setForm({ clientId: "", secret: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(service: NativeService, id: string, label: string) {
    if (!window.confirm(`Disconnect ${label} from ${service.name}?`)) return;
    setBusy(id);
    try {
      await post(`/api/integrations/oauth/${service.key}/disconnect`, "POST", { integrationId: id });
      showToast("Disconnected.");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't disconnect.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      {toast}
      <div>
        <h2 className="text-base font-semibold text-foreground">Slack, HubSpot and Microsoft 365</h2>
        <p className="text-sm text-muted">Each workspace uses its own app for these services (one-time setup). Or just ask Baba &ldquo;connect my Slack&rdquo;.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.key} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted">{s.what}</p>
              </div>
              {s.accounts.length > 0 ? <Badge tone="success">Connected</Badge> : s.appClientId ? <Badge tone="info">App ready</Badge> : <Badge>Not set up</Badge>}
            </div>
            {s.accounts.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {s.accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                      <CircleCheck aria-hidden="true" className={a.status === "error" ? "size-4 text-warning" : "size-4 text-success"} />
                      <span className="truncate">{a.label}</span>
                      {a.isDefault && <span className="text-[11px] text-subtle">default</span>}
                      {a.status === "error" && <span className="text-[11px] text-warning">reconnect</span>}
                    </span>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-danger" loading={busy === a.id} onClick={() => disconnect(s, a.id, a.label)}>
                        Disconnect
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && available && (
              <div className="mt-auto flex flex-wrap gap-2">
                {s.appClientId && (
                  <a
                    href={`/api/integrations/oauth/${s.key}/connect?return=/integrations`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90"
                  >
                    <Plug aria-hidden="true" className="size-3.5" /> {s.accounts.length ? "Add account" : "Connect"}
                  </a>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setSetup(s);
                  }}
                >
                  <KeyRound aria-hidden="true" className="size-3.5" /> {s.appClientId ? "Replace app" : "Set up app"}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {!available && <p className="text-xs text-subtle">Connections can&apos;t be stored securely on this server yet (SUPABASE_SECRET_KEY is missing).</p>}

      <Sheet open={setup !== null} onClose={() => setSetup(null)} side="right" title={setup ? `Set up ${setup.name}` : ""}>
        {setup && (
          <form noValidate onSubmit={saveApp} className="space-y-4 p-4">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
              {setup.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <code className="block break-all rounded-control border border-border bg-surface-raised p-3 text-xs text-foreground">{setup.redirectUri}</code>
            <a href={setup.consoleUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">
              Open the {setup.name} developer console
            </a>
            {error && <Alert variant="error">{error}</Alert>}
            <Input id="na-id" label="Client ID" autoComplete="off" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
            <PasswordInput id="na-secret" label="Client secret" autoComplete="off" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
            <p className="text-[11px] text-subtle">Saved encrypted for this workspace only; the secret is never shown again.</p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setSetup(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy === "app"} loadingText="Saving…">
                Save
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  );
}
