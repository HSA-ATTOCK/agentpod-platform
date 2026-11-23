"use client";

import { Check, KeyRound, MessageSquare, Plus, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { integrationCatalog, type Integration, type IntegrationCategory } from "@/config/integrations";
import { routes } from "@/config/routes";
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

export type GoogleAccountRow = { id: string; email: string; isDefault: boolean; status: string; connectedBy: string | null; createdAt: string };
export type ApiKeyRow = { id: string; name: string; host: string; connectedBy: string | null; createdAt: string };

type IntegrationsViewProps = {
  googleAccounts: GoogleAccountRow[];
  apiKeys: ApiKeyRow[];
  googleConfigured: boolean;
  keysAvailable: boolean;
  canManage: boolean;
  flash: { connected?: string; account?: string; error?: string };
};

/** First-letter placeholder instead of real brand logos. */
function Monogram({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface-raised text-sm font-bold",
        muted ? "text-subtle" : "text-foreground",
      )}
    >
      {name[0]}
    </span>
  );
}

const CONNECT_GOOGLE = `/api/integrations/google/connect?return=${encodeURIComponent(routes.integrations)}`;

export function IntegrationsView({ googleAccounts, apiKeys, googleConfigured, keysAvailable, canManage, flash }: IntegrationsViewProps) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", host: "", header: "Authorization", prefix: "Bearer ", key: "" });
  const [keyError, setKeyError] = useState<string | null>(null);

  const googleConnected = googleAccounts.some((a) => a.status === "connected");
  const googleBroken = googleAccounts.filter((a) => a.status === "error");
  const q = query.trim().toLowerCase();
  const shown = integrationCatalog.filter((i) => (filter === "all" || i.category === filter) && (!q || i.name.toLowerCase().includes(q)));

  async function post(url: string, method: "POST" | "DELETE", body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  }

  async function googleAction(account: GoogleAccountRow, action: "disconnect" | "make_default") {
    if (action === "disconnect" && !window.confirm(`Disconnect ${account.email}? Baba will lose access to its Gmail, Drive and Calendar.`)) return;
    setBusy(`${action}-${account.id}`);
    try {
      await post("/api/integrations/google/disconnect", "POST", { integrationId: account.id, action });
      showToast(action === "disconnect" ? `${account.email} disconnected.` : `${account.email} is now the default.`);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update the connection.");
    } finally {
      setBusy(null);
    }
  }

  async function removeKey(key: ApiKeyRow) {
    if (!window.confirm(`Remove the ${key.name} key? Baba won't be able to use ${key.name} until it's added again.`)) return;
    setBusy(`key-${key.id}`);
    try {
      await post("/api/integrations/keys", "DELETE", { integrationId: key.id });
      showToast(`${key.name} key removed.`);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't remove the key.");
    } finally {
      setBusy(null);
    }
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    setKeyError(null);
    if (!keyForm.name.trim() || !keyForm.host.trim() || keyForm.key.trim().length < 8) {
      setKeyError("Fill in the name, the API address and the whole key.");
      return;
    }
    setBusy("save-key");
    try {
      await post("/api/integrations/keys", "POST", {
        serviceName: keyForm.name,
        apiHost: keyForm.host,
        headerName: keyForm.header,
        headerPrefix: keyForm.prefix,
        key: keyForm.key,
      });
      setKeyFormOpen(false);
      setKeyForm({ name: "", host: "", header: "Authorization", prefix: "Bearer ", key: "" });
      showToast("Key saved securely.");
      router.refresh();
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Couldn't save the key.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Tools Baba can use for this workspace. Connect them here, or just ask Baba in the chat."
        actions={
          <ButtonLink href={`${routes.ask}?prompt=${encodeURIComponent("Help me connect my tools")}`} variant="secondary">
            <MessageSquare aria-hidden="true" className="size-4" />
            Connect with Baba
          </ButtonLink>
        }
      />

      {flash.connected === "google" && (
        <Alert variant="success" title="Google connected">
          Baba can now use Gmail, Drive and Calendar{flash.account ? ` for ${flash.account}` : ""}. Try asking: &ldquo;Summarise my unread
          emails from today&rdquo;.
        </Alert>
      )}
      {flash.error && <Alert variant="error">{flash.error}</Alert>}
      {googleBroken.length > 0 && (
        <Alert variant="error" title="Google needs reconnecting">
          Access for {googleBroken.map((a) => a.email).join(", ")} expired or was removed. Click Add Google account and sign in with it again.
        </Alert>
      )}

      {/* ---- Connected to this workspace ---- */}
      <section aria-labelledby="connected-title" className="space-y-4">
        <h2 id="connected-title" className="text-lg font-semibold text-foreground">
          Connected to this workspace
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-foreground">Google accounts</h3>
                <p className="text-xs text-muted">Gmail, Drive, Sheets and Calendar. Baba uses the default unless you name another.</p>
              </div>
              {canManage && googleConfigured && (
                <a href={CONNECT_GOOGLE} className={buttonClasses({ size: "sm", variant: googleConnected ? "secondary" : "primary" })}>
                  <Plus aria-hidden="true" className="size-3.5" />
                  {googleConnected ? "Add account" : "Connect Google"}
                </a>
              )}
            </div>
            {googleAccounts.length === 0 ? (
              <p className="rounded-control border border-dashed border-border p-4 text-center text-sm text-subtle">
                {googleConfigured ? "No Google accounts connected yet." : "Google sign-in isn't available on this server yet."}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-control border border-border">
                {googleAccounts.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        <span className="truncate">{account.email}</span>
                        {account.isDefault && <Badge tone="accent">Default</Badge>}
                        {account.status === "error" && <Badge tone="danger">Reconnect</Badge>}
                      </p>
                      <p className="text-[11px] text-subtle">
                        Added <LocalTime iso={account.createdAt} format="date" />
                        {account.connectedBy ? ` by ${account.connectedBy}` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        {!account.isDefault && (
                          <Button size="sm" variant="ghost" loading={busy === `make_default-${account.id}`} onClick={() => googleAction(account, "make_default")}>
                            Make default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          loading={busy === `disconnect-${account.id}`}
                          onClick={() => googleAction(account, "disconnect")}
                        >
                          Disconnect
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-foreground">Services with an API key</h3>
                <p className="text-xs text-muted">Keys are encrypted and only used for requests to that service. Baba never sees them.</p>
              </div>
              {canManage && keysAvailable && (
                <Button size="sm" variant="secondary" onClick={() => { setKeyError(null); setKeyFormOpen(true); }}>
                  <KeyRound aria-hidden="true" className="size-3.5" />
                  Add key
                </Button>
              )}
            </div>
            {apiKeys.length === 0 ? (
              <p className="rounded-control border border-dashed border-border p-4 text-center text-sm text-subtle">
                None yet. Ask Baba &ldquo;connect my Airtable&rdquo; (or any service with an API key) and it will guide you.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-control border border-border">
                {apiKeys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{key.name}</p>
                      <p className="truncate text-[11px] text-subtle">
                        {key.host} · added <LocalTime iso={key.createdAt} format="date" />
                        {key.connectedBy ? ` by ${key.connectedBy}` : ""}
                      </p>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-danger" loading={busy === `key-${key.id}`} onClick={() => removeKey(key)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {!canManage && <p className="text-xs text-subtle">Only owners and admins can connect or remove tools.</p>}
      </section>

      <Card className="flex items-start gap-3.5 p-4 sm:p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-warning/10 text-warning">
          <ShieldCheck aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sensitive actions need your approval</h2>
          <p className="mt-0.5 text-xs text-muted">
            Connected tools let Baba read and prepare work. It always asks before sending emails, creating events or changing
            anything in another service.
          </p>
        </div>
      </Card>

      {/* ---- Catalogue ---- */}
      <section className="space-y-4" aria-label="All integrations">
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
            {shown.map((integration) => {
              const isGoogle = integration.provider === "google";
              return (
                <li key={integration.id}>
                  <Card className={cn("flex h-full flex-col justify-between p-5", integration.comingSoon && "opacity-75")}>
                    <div>
                      <div className="flex items-center justify-between">
                        <Monogram name={integration.name} muted={integration.comingSoon} />
                        {isGoogle && googleConnected ? (
                          <Badge tone="success">
                            Connected{googleAccounts.length > 1 ? ` (${googleAccounts.length})` : ""}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">{integration.comingSoon ? "Coming soon" : "Not connected"}</Badge>
                        )}
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
                        <Button size="sm" variant={isGoogle && googleConnected ? "secondary" : "primary"} onClick={() => setConnecting(integration)}>
                          {isGoogle && googleConnected ? "Details" : "Connect"}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Details / connect sheet ---- */}
      <Sheet
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        side="center"
        title={connecting ? `${connecting.name}` : "Connect"}
        footer={
          connecting && (
            <>
              <Button variant="secondary" onClick={() => setConnecting(null)}>
                Close
              </Button>
              {connecting.provider === "google" && canManage && googleConfigured && (
                // A full page visit: the browser goes to Google and comes back
                <a href={CONNECT_GOOGLE} className={buttonClasses({})}>
                  {googleConnected ? "Add another Google account" : "Continue to Google"}
                </a>
              )}
            </>
          )
        }
      >
        {connecting && (
          <div className="space-y-4 p-4 text-sm">
            <div>
              <h3 className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Check aria-hidden="true" className="size-4 text-success" /> What Baba can do
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
            {connecting.provider === "google" ? (
              googleConnected ? (
                <Alert variant="success">
                  Connected: {googleAccounts.map((a) => a.email).join(", ")}. One sign-in per account covers Gmail, Drive, Sheets and
                  Calendar.
                </Alert>
              ) : !googleConfigured ? (
                <Alert variant="info">Google sign-in isn&apos;t available on this server yet.</Alert>
              ) : !canManage ? (
                <Alert variant="info">Only owners and admins can connect tools. Ask one of them to connect Google.</Alert>
              ) : (
                <Alert variant="info">
                  You&apos;ll sign in on Google&apos;s own page and allow access. You can connect several Google accounts and disconnect
                  any of them at any time.
                </Alert>
              )
            ) : (
              <Alert variant="info">
                {connecting.name} is coming soon. This is exactly what Baba will be able to do once it&apos;s switched on.
              </Alert>
            )}
          </div>
        )}
      </Sheet>

      {/* ---- Add API key (secure form) ---- */}
      <Sheet open={keyFormOpen} onClose={() => setKeyFormOpen(false)} side="center" title="Add an API key">
        <form noValidate onSubmit={saveKey} className="space-y-4 p-4">
          <p className="text-sm text-muted">
            Not sure what to enter? Ask Baba in the chat (&ldquo;connect my Airtable&rdquo;) and it will show you where to get the key
            and fill in the details.
          </p>
          {keyError && <Alert variant="error">{keyError}</Alert>}
          <Input id="k-name" label="Service name" placeholder="e.g. Airtable" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} />
          <Input
            id="k-host"
            label="API address"
            placeholder="e.g. api.airtable.com"
            hint="Baba can only send this key to this address."
            value={keyForm.host}
            onChange={(e) => setKeyForm({ ...keyForm, host: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input id="k-header" label="Header" value={keyForm.header} onChange={(e) => setKeyForm({ ...keyForm, header: e.target.value })} />
            <Input id="k-prefix" label="Text before the key" value={keyForm.prefix} onChange={(e) => setKeyForm({ ...keyForm, prefix: e.target.value })} />
          </div>
          <PasswordInput id="k-key" label="API key" autoComplete="off" value={keyForm.key} onChange={(e) => setKeyForm({ ...keyForm, key: e.target.value })} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setKeyFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy === "save-key"} loadingText="Saving…">Save key securely</Button>
          </div>
        </form>
      </Sheet>
      {toast}
    </div>
  );
}
