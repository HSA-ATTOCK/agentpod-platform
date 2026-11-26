"use client";

import { CircleCheck, KeyRound, Link2, Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { ChatItem } from "@/types/chat";

type ConnectItem = Extract<ChatItem, { type: "connect_request" }>;
type KeyItem = Extract<ChatItem, { type: "key_request" }>;

type Shared = {
  /** Owners and admins can connect tools. */
  canManage: boolean;
  /** The conversation this card is in (to come back to after a same-tab sign-in). */
  conversationId: string;
  onUpdate: (patch: Partial<ChatItem>) => void;
  /** Sends a message to Baba (e.g. "I've connected Google"). */
  onSend: (text: string) => void;
  busy: boolean;
};

const SERVICES = {
  google: { name: "Google", what: "Gmail, Drive, Sheets and Calendar", connect: "/api/integrations/google/connect" },
  slack: { name: "Slack", what: "Read channels and post messages (with your approval)", connect: "/api/integrations/oauth/slack/connect" },
  hubspot: { name: "HubSpot", what: "Contacts and deals", connect: "/api/integrations/oauth/hubspot/connect" },
  microsoft: { name: "Microsoft 365", what: "Outlook mail and calendar", connect: "/api/integrations/oauth/microsoft/connect" },
  quickbooks: { name: "QuickBooks", what: "Reports, invoices and customers (read-only)", connect: "/api/integrations/oauth/quickbooks/connect" },
  xero: { name: "Xero", what: "Reports, invoices and contacts (read-only)", connect: "/api/integrations/oauth/xero/connect" },
  shopify: { name: "Shopify", what: "Orders, products, customers and stock (read-only)", connect: "/api/integrations/oauth/shopify/connect" },
} as const;

/** "Connect …" button that Baba put in the chat. Signs in in a small window, so the chat stays put. */
export function ConnectRequestCard({ item, canManage, conversationId, onUpdate, onSend, busy }: Shared & { item: ConnectItem }) {
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const service = SERVICES[item.service] ?? SERVICES.google;
  // Shopify signs in per store
  const [shop, setShop] = useState("");
  const needsShop = item.service === "shopify";
  const connectUrl = (extra: string) => `${service.connect}?${extra}${needsShop ? `&shop=${encodeURIComponent(shop.trim())}` : ""}`;

  // The sign-in window reports back with postMessage (only from our own origin)
  useEffect(() => {
    if (item.status !== "pending") return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; provider?: string; ok?: boolean; account?: string; error?: string };
      if (data?.type !== "baba-connect" || (data.provider && data.provider !== item.service)) return;
      setWaiting(false);
      if (data.ok) {
        setError(null);
        onUpdate({ status: "connected", account: data.account } as Partial<ChatItem>);
      } else {
        setError(data.error ?? `${service.name} sign-in didn't finish.`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [item.status, item.service, service.name, onUpdate]);

  function connect() {
    setError(null);
    if (needsShop && !shop.trim()) {
      setError("Enter your store address first.");
      return;
    }
    const width = 520;
    const height = 680;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      connectUrl("popup=1"),
      `baba-connect-${item.service}`,
      `width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      // Pop-ups blocked: sign in in this tab and come back to this conversation
      window.location.assign(connectUrl(`return=${encodeURIComponent(`/ask?c=${conversationId}`)}`));
      return;
    }
    setWaiting(true);
  }

  return (
    <section aria-label={`Connect ${service.name}`} className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-info/20 bg-info/10 text-info">
          <Link2 aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connect {service.name}</h3>
            <p className="text-xs text-muted">
              {service.what}
              {item.reason ? `: ${item.reason}` : "."}
            </p>
          </div>
          {item.status === "connected" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CircleCheck aria-hidden="true" className="size-4" /> Connected{item.account ? ` as ${item.account}` : ""}
              </p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onSend(`I've connected ${service.name}${item.account ? ` (${item.account})` : ""}. Please continue.`)}
              >
                Continue
              </Button>
            </div>
          ) : canManage ? (
            <>
              {needsShop && (
                <Input id={`shop-${item.id}`} label="Store address" placeholder="your-store.myshopify.com" value={shop} onChange={(e) => setShop(e.target.value)} />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={connect} loading={waiting} loadingText={`Waiting for ${service.name}…`}>
                  Connect {service.name}
                </Button>
                {waiting && (
                  <button type="button" onClick={connect} className="text-xs text-muted hover:text-foreground">
                    Window didn&apos;t open? Try again
                  </button>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-subtle">
                <Lock aria-hidden="true" className="size-3" /> You sign in on {service.name}&apos;s own page. Baba never sees your password,
                and sending or changing anything always needs your approval.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">Only owners and admins can connect tools. Ask one of them to connect {service.name} for this workspace.</p>
          )}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </div>
    </section>
  );
}

/** Secure box for an API key Baba asked for. The key goes only to our server, never into the chat or to Claude. */
export function KeyRequestCard({ item, canManage, onUpdate, onSend, busy }: Shared & { item: KeyItem }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState(item.serviceName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (key.trim().length < 8) {
      setError("Paste the whole key.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: name.trim() || item.serviceName,
          apiHost: item.apiHost,
          headerName: item.headerName,
          headerPrefix: item.headerPrefix,
          queryParam: item.queryParam,
          key,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save the key.");
      setKey("");
      onUpdate({ status: "saved", serviceName: name.trim() || item.serviceName } as Partial<ChatItem>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={`Add ${item.serviceName} API key`} className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-warning/20 bg-warning/10 text-warning">
          <KeyRound aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add your {item.serviceName} API key</h3>
            <p className="text-xs text-muted">Used only for requests to {item.apiHost}.</p>
          </div>
          {item.instructions && (
            <div className="whitespace-pre-wrap rounded-control border border-border bg-surface p-3 text-sm leading-relaxed text-foreground">
              {item.instructions}
            </div>
          )}
          {item.status === "saved" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CircleCheck aria-hidden="true" className="size-4" /> Key saved securely
              </p>
              <Button size="sm" disabled={busy} onClick={() => onSend(`I've added the ${item.serviceName} API key. Please continue.`)}>
                Continue
              </Button>
            </div>
          ) : canManage ? (
            <form noValidate onSubmit={save} className="space-y-3">
              <Input id={`key-name-${item.id}`} label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <PasswordInput
                id={`key-${item.id}`}
                label="API key"
                autoComplete="off"
                placeholder="Paste the key here"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button type="submit" size="sm" loading={saving} loadingText="Saving…">
                Save key securely
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] text-subtle">
                <Lock aria-hidden="true" className="size-3" /> The key is encrypted and stored for this workspace. It never appears in the
                chat and Baba never sees it. Remove it any time in Integrations.
              </p>
            </form>
          ) : (
            <p className="text-xs text-muted">Only owners and admins can add keys. Ask one of them to add it.</p>
          )}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </div>
    </section>
  );
}

type GoogleAppItem = Extract<ChatItem, { type: "google_app_request" }>;

const GOOGLE_STEPS = [
  "Go to console.cloud.google.com and sign in. Create a project (top bar → project menu → New project), e.g. \"Baba\".",
  "APIs & Services → Library: search for and Enable the Gmail API, Google Drive API and Google Calendar API.",
  "APIs & Services → OAuth consent screen (Google Auth Platform): choose External, app name \"Baba\", your email as support and developer contact. Under Audience → Test users, add every Gmail address you want to connect.",
  "Credentials → Create credentials → OAuth client ID → Application type: Web application.",
  "Under Authorised redirect URIs, click Add URI and paste the address below exactly. Then click Create.",
  "Copy the Client ID and Client secret Google shows you into the boxes here (not into the chat).",
];

/**
 * One-time setup of the workspace's own Google app (Client ID + secret), entered in this card
 * only: they go straight to the server, encrypted. Once saved, the card becomes the Connect button.
 */
export function GoogleAppCard({ item, ...shared }: Shared & { item: GoogleAppItem }) {
  const { canManage, onUpdate } = shared;
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (item.status === "saved") {
    // Now it's just the Connect button
    return (
      <ConnectRequestCard
        {...shared}
        item={{ id: item.id, type: "connect_request", service: "google", reason: item.reason, status: item.connectStatus ?? "pending", account: item.account }}
        onUpdate={(patch) => {
          const p = patch as { status?: "pending" | "connected"; account?: string };
          onUpdate({ connectStatus: p.status, account: p.account } as Partial<ChatItem>);
        }}
      />
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!clientId.trim().endsWith(".apps.googleusercontent.com")) {
      setError("The Client ID ends with .apps.googleusercontent.com. Copy it again from Google.");
      return;
    }
    if (secret.trim().length < 10) {
      setError("Paste the whole Client secret (it usually starts with GOCSPX-).");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/integrations/google/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: secret.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't save.");
      setSecret("");
      onUpdate({ status: "saved", connectStatus: "pending" } as Partial<ChatItem>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Set up Google for this workspace" className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-info/20 bg-info/10 text-info">
          <Link2 aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Set up Google for this workspace (one time)</h3>
            <p className="text-xs text-muted">
              About 10 minutes. After this, connecting any Gmail, Calendar or Drive is one click{item.reason ? ` (${item.reason})` : ""}.
            </p>
          </div>
          {canManage ? (
            <>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
                {GOOGLE_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="rounded-control border border-border bg-surface p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">Authorised redirect URI</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all text-xs text-foreground">{item.redirectUri}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard?.writeText(item.redirectUri).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                    }
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <form noValidate onSubmit={save} className="space-y-3">
                <Input
                  id={`gid-${item.id}`}
                  label="Client ID"
                  autoComplete="off"
                  placeholder="1234567890-abc….apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
                <PasswordInput
                  id={`gsecret-${item.id}`}
                  label="Client secret"
                  autoComplete="off"
                  placeholder="GOCSPX-…"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <Button type="submit" size="sm" loading={saving} loadingText="Saving…">
                  Save and continue
                </Button>
                <p className="flex items-center gap-1.5 text-[11px] text-subtle">
                  <Lock aria-hidden="true" className="size-3" /> Saved encrypted for this workspace only. It never appears in the chat
                  and Baba never sees it. You can replace or remove it in Integrations.
                </p>
              </form>
            </>
          ) : (
            <p className="text-xs text-muted">Only owners and admins can set this up. Ask one of them to say &ldquo;connect my Gmail&rdquo; to Baba.</p>
          )}
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </div>
    </section>
  );
}

type DbItem = Extract<ChatItem, { type: "db_request" }>;

/** Secure form for a read-only database connection. The password goes to our server only. */
export function DatabaseRequestCard({ item, canManage, onUpdate, onSend, busy }: Shared & { item: DbItem }) {
  const [form, setForm] = useState({
    name: "",
    engine: item.engine,
    host: "",
    port: item.engine === "mysql" ? "3306" : "5432",
    database: "",
    user: "",
    password: "",
    ssl: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't connect.");
      setForm((f) => ({ ...f, password: "" }));
      onUpdate({ status: "saved", name: form.name } as Partial<ChatItem>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Connect a database" className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-info/20 bg-info/10 text-info">
          <Lock aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Connect a database (read-only)</h3>
            {item.reason && <p className="text-xs text-muted">{item.reason}</p>}
          </div>
          {item.status === "saved" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CircleCheck aria-hidden="true" className="size-4" /> {item.name ?? "Database"} connected
              </p>
              <Button size="sm" disabled={busy} onClick={() => onSend(`I've connected the database "${item.name ?? ""}". Please continue.`)}>
                Continue
              </Button>
            </div>
          ) : canManage ? (
            <form noValidate onSubmit={save} className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input id={`db-name-${item.id}`} label="Name" placeholder="e.g. Sales DB" value={form.name} onChange={set("name")} />
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Type</span>
                  <select
                    className="h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-foreground"
                    value={form.engine}
                    onChange={(e) => setForm({ ...form, engine: e.target.value as "postgres" | "mysql", port: e.target.value === "mysql" ? "3306" : "5432" })}
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </label>
                <Input id={`db-host-${item.id}`} label="Host" placeholder="db.example.com" autoComplete="off" value={form.host} onChange={set("host")} />
                <Input id={`db-port-${item.id}`} label="Port" inputMode="numeric" value={form.port} onChange={set("port")} />
                <Input id={`db-db-${item.id}`} label="Database" autoComplete="off" value={form.database} onChange={set("database")} />
                <Input id={`db-user-${item.id}`} label="Username" autoComplete="off" value={form.user} onChange={set("user")} />
              </div>
              <PasswordInput id={`db-pass-${item.id}`} label="Password" autoComplete="new-password" value={form.password} onChange={set("password")} />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.ssl} onChange={(e) => setForm({ ...form, ssl: e.target.checked })} /> Use SSL (recommended)
              </label>
              <Button type="submit" size="sm" loading={saving} loadingText="Testing connection…">
                Test and save
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] text-subtle">
                <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" /> Best practice: use a database user that can only read. Baba can only run read
                queries anyway (read-only transaction, 15-second limit). The password is encrypted, never shown in the chat and never sent to the AI.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted">Only workspace owners and admins can connect a database. Ask one of them to continue.</p>
          )}
        </div>
      </div>
    </section>
  );
}

type OAuthAppItem = Extract<ChatItem, { type: "oauth_app_request" }>;

/** One-time setup of the workspace's own Slack / HubSpot / Microsoft app; then it becomes the Connect button. */
export function OAuthAppCard({ item, canManage, conversationId, onUpdate, onSend, busy }: Shared & { item: OAuthAppItem }) {
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (item.status === "saved") {
    return (
      <ConnectRequestCard
        item={{ id: item.id, type: "connect_request", service: item.service, reason: item.reason, status: item.connectStatus ?? "pending", account: item.account }}
        canManage={canManage}
        conversationId={conversationId}
        onUpdate={(patch) => onUpdate({ connectStatus: (patch as { status?: "pending" | "connected" }).status, account: (patch as { account?: string }).account } as Partial<ChatItem>)}
        onSend={onSend}
        busy={busy}
      />
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/oauth/${item.service}/app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: secret.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setSecret("");
      onUpdate({ status: "saved" } as Partial<ChatItem>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={`Set up ${item.serviceName}`} className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-info/20 bg-info/10 text-info">
          <KeyRound aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Set up {item.serviceName} for this workspace (one time)</h3>
            {item.reason && <p className="text-xs text-muted">{item.reason}</p>}
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
            {item.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted">Redirect address</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-control border border-border bg-surface p-2 text-xs text-foreground">{item.redirectUri}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(item.redirectUri);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // clipboard blocked
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <a href={item.consoleUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent hover:underline">
              Open {item.serviceName} developer console
            </a>
          </div>
          {canManage ? (
            <form noValidate onSubmit={save} className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <Input id={`oa-id-${item.id}`} label="Client ID" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <PasswordInput id={`oa-secret-${item.id}`} label="Client secret" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
              <Button type="submit" size="sm" loading={saving} loadingText="Saving…" disabled={!clientId.trim() || !secret.trim()}>
                Save securely
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] text-subtle">
                <Lock aria-hidden="true" className="size-3" /> Encrypted for this workspace only. Never paste these into the chat.
              </p>
            </form>
          ) : (
            <p className="text-xs text-muted">Only owners and admins can set this up.</p>
          )}
        </div>
      </div>
    </section>
  );
}
