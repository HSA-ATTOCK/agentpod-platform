import "server-only";
import { routes } from "@/config/routes";
import { sendEmail } from "@/lib/email/mailer";
import { briefingEmail } from "@/lib/email/templates";
import { googleAccessToken, listGoogleAccounts } from "@/lib/integrations/google/oauth";
import { shopifyGraphql } from "@/lib/integrations/native-tools";
import { listOAuthAccounts, oauthAccessToken } from "@/lib/integrations/oauth-apps";
import { serverOrigin } from "@/lib/origin";
import { notifyInApp } from "@/lib/platform/account";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/supabase/admin";
import { dayRange, formatDay, formatTime, localNow, safeTimeZone } from "./time";

/**
 * The daily briefing: a short morning summary per person and workspace, switched on in
 * Settings → Notifications. It reads the workspace's connected tools directly (no AI, so it
 * costs nothing) and is sent in the bell menu and by email.
 * Outside content (email subjects, event names) is only shown to the person, never given
 * to an AI as instructions.
 */

export type BriefingSection = { title: string; lines: string[] };
export type Briefing = { heading: string; sections: BriefingSection[]; summary: string };

const TIMEOUT = 15_000;

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return (await res.json()) as T;
}

const clip = (text: string, max = 90) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Runs one part; a failure becomes a short note instead of breaking the whole briefing. */
async function part(name: string, run: () => Promise<BriefingSection | null>): Promise<BriefingSection | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`[briefing] ${name}:`, error instanceof Error ? error.message : error);
    return { title: name, lines: [`Couldn't read ${name} this morning. If this keeps happening, reconnect it in Integrations.`] };
  }
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

async function calendar(workspaceId: string, tz: string, date: string): Promise<BriefingSection | null> {
  const { start, end } = dayRange(tz, date);
  const google = (await listGoogleAccounts(workspaceId)).length ? await googleAccessToken(workspaceId) : null;
  let events: { at: string; title: string }[] | null = null;
  if (google) {
    const params = new URLSearchParams({ timeMin: new Date(start).toISOString(), timeMax: new Date(end).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "15" });
    const data = await getJson<{ items: { summary?: string; start: { dateTime?: string; date?: string } }[] }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${google.token}` } },
    );
    events = data.items.map((e) => ({ at: e.start.dateTime ? formatTime(tz, e.start.dateTime) : "All day", title: e.summary ?? "(no title)" }));
  } else if ((await listOAuthAccounts(workspaceId, "microsoft")).length) {
    const ms = await oauthAccessToken(workspaceId, "microsoft");
    if (!ms) return null;
    const params = new URLSearchParams({ startDateTime: new Date(start).toISOString(), endDateTime: new Date(end).toISOString(), $top: "15", $orderby: "start/dateTime", $select: "subject,start,isAllDay" });
    const data = await getJson<{ value: { subject?: string; isAllDay?: boolean; start: { dateTime: string; timeZone: string } }[] }>(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
      { headers: { Authorization: `Bearer ${ms.token}`, Prefer: 'outlook.timezone="UTC"' } },
    );
    events = data.value.map((e) => ({ at: e.isAllDay ? "All day" : formatTime(tz, `${e.start.dateTime.replace(/Z?$/, "")}Z`), title: e.subject ?? "(no title)" }));
  }
  if (!events) return null;
  return { title: "Today's calendar", lines: events.length ? events.map((e) => `${e.at}  ${clip(e.title)}`) : ["Nothing on your calendar today."] };
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function inbox(workspaceId: string): Promise<BriefingSection | null> {
  const google = (await listGoogleAccounts(workspaceId)).length ? await googleAccessToken(workspaceId) : null;
  if (google) {
    const auth = { headers: { Authorization: `Bearer ${google.token}` } };
    const list = await getJson<{ messages?: { id: string }[]; resultSizeEstimate?: number }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: "in:inbox is:unread newer_than:1d", maxResults: "5" })}`,
      auth,
    );
    const ids = list.messages ?? [];
    if (!ids.length) return { title: "Email", lines: ["No new unread emails in the last 24 hours."] };
    const details = await Promise.all(
      ids.map((m) =>
        getJson<{ payload?: { headers?: { name: string; value: string }[] } }>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          auth,
        ),
      ),
    );
    const head = (h: { name: string; value: string }[] | undefined, n: string) => h?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    const total = Math.max(list.resultSizeEstimate ?? ids.length, ids.length);
    return {
      title: "Email",
      lines: [
        `${total} unread email${total === 1 ? "" : "s"} in the last 24 hours${total > ids.length ? ` (latest ${ids.length} below)` : ""}:`,
        ...details.map((d) => `${clip(head(d.payload?.headers, "from").replace(/<[^>]*>/, "").replace(/"/g, ""), 40)}: ${clip(head(d.payload?.headers, "subject") || "(no subject)", 70)}`),
      ],
    };
  }
  if ((await listOAuthAccounts(workspaceId, "microsoft")).length) {
    const ms = await oauthAccessToken(workspaceId, "microsoft");
    if (!ms) return null;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const params = new URLSearchParams({ $filter: `isRead eq false and receivedDateTime ge ${since}`, $top: "5", $select: "subject,from" });
    const data = await getJson<{ value: { subject?: string; from?: { emailAddress?: { name?: string; address?: string } } }[] }>(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params}`,
      { headers: { Authorization: `Bearer ${ms.token}` } },
    );
    if (!data.value.length) return { title: "Email", lines: ["No new unread emails in the last 24 hours."] };
    return {
      title: "Email",
      lines: [
        `Unread emails from the last 24 hours${data.value.length === 5 ? " (latest 5)" : ""}:`,
        ...data.value.map((m) => `${clip(m.from?.emailAddress?.name || m.from?.emailAddress?.address || "Unknown", 40)}: ${clip(m.subject || "(no subject)", 70)}`),
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Money: overdue invoices and yesterday's shop sales
// ---------------------------------------------------------------------------

const money = (amount: number, currency: string) => `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`.trim();

async function invoices(workspaceId: string, date: string): Promise<BriefingSection | null> {
  const lines: string[] = [];
  if ((await listOAuthAccounts(workspaceId, "quickbooks")).length) {
    const qb = await oauthAccessToken(workspaceId, "quickbooks");
    if (qb) {
      const base = `${qb.config.base ?? "https://quickbooks.api.intuit.com"}/v3/company/${qb.config.realmId}`;
      const query = `SELECT * FROM Invoice WHERE Balance > '0' AND DueDate < '${date}' MAXRESULTS 100`;
      const data = await getJson<{ QueryResponse?: { Invoice?: { Balance: number; CurrencyRef?: { value: string } }[] } }>(
        `${base}/query?minorversion=75&query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${qb.token}`, Accept: "application/json" } },
      );
      const list = data.QueryResponse?.Invoice ?? [];
      const total = list.reduce((sum, i) => sum + Number(i.Balance || 0), 0);
      lines.push(list.length ? `QuickBooks: ${list.length} overdue invoice${list.length === 1 ? "" : "s"}, ${money(total, list[0]?.CurrencyRef?.value ?? "")} unpaid.` : "QuickBooks: no overdue invoices.");
    }
  }
  if ((await listOAuthAccounts(workspaceId, "xero")).length) {
    const xero = await oauthAccessToken(workspaceId, "xero");
    if (xero) {
      const [y, m, d] = date.split("-").map(Number);
      const where = `Type=="ACCREC"&&Status=="AUTHORISED"&&DueDate<DateTime(${y},${m},${d})`;
      const data = await getJson<{ Invoices?: { AmountDue: number; CurrencyCode?: string }[] }>(
        `https://api.xero.com/api.xro/2.0/Invoices?${new URLSearchParams({ where, page: "1" })}`,
        { headers: { Authorization: `Bearer ${xero.token}`, "xero-tenant-id": xero.config.tenantId, Accept: "application/json" } },
      );
      const list = data.Invoices ?? [];
      const total = list.reduce((sum, i) => sum + Number(i.AmountDue || 0), 0);
      lines.push(list.length ? `Xero: ${list.length}${list.length === 100 ? "+" : ""} overdue invoice${list.length === 1 ? "" : "s"}, ${money(total, list[0]?.CurrencyCode ?? "")} unpaid.` : "Xero: no overdue invoices.");
    }
  }
  return lines.length ? { title: "Invoices", lines } : null;
}

async function shop(workspaceId: string): Promise<BriefingSection | null> {
  if (!(await listOAuthAccounts(workspaceId, "shopify")).length) return null;
  const sh = await oauthAccessToken(workspaceId, "shopify");
  if (!sh) return null;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const data = (await shopifyGraphql(
    sh.token,
    sh.config.shop,
    `query($q:String){orders(first:250,query:$q){nodes{totalPriceSet{shopMoney{amount currencyCode}}}}}`,
    { q: `created_at:>=${since} -status:cancelled` },
  )) as unknown as { orders: { nodes: { totalPriceSet: { shopMoney: { amount: string; currencyCode: string } } }[] } };
  const orders = data.orders.nodes;
  const total = orders.reduce((sum, o) => sum + Number(o.totalPriceSet.shopMoney.amount), 0);
  return {
    title: "Shop",
    lines: [orders.length ? `${orders.length}${orders.length === 250 ? "+" : ""} order${orders.length === 1 ? "" : "s"} in the last 24 hours, ${money(total, orders[0].totalPriceSet.shopMoney.currencyCode)}.` : "No orders in the last 24 hours."],
  };
}

// ---------------------------------------------------------------------------
// Baba's own activity
// ---------------------------------------------------------------------------

async function activity(workspaceId: string): Promise<BriefingSection> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [tasks, approvals, forms] = await Promise.all([
    db.from("tasks").select("status, workflow_id").eq("workspace_id", workspaceId).gte("started_at", since).limit(1000),
    db.from("tool_approvals").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
    db.from("site_form_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", since),
  ]);
  const rows = tasks.data ?? [];
  const done = rows.filter((t) => t.status === "succeeded").length;
  const failed = rows.filter((t) => t.status === "failed").length;
  const workflowRuns = rows.filter((t) => t.workflow_id).length;
  const lines: string[] = [];
  if (approvals.count) lines.push(`${approvals.count} action${approvals.count === 1 ? " is" : "s are"} waiting for your approval.`);
  lines.push(rows.length ? `${done} task${done === 1 ? "" : "s"} finished in the last 24 hours${failed ? `, ${failed} failed` : ""}.` : "No tasks in the last 24 hours.");
  if (workflowRuns) lines.push(`${workflowRuns} workflow run${workflowRuns === 1 ? "" : "s"}.`);
  if (forms.count) lines.push(`${forms.count} new form repl${forms.count === 1 ? "y" : "ies"} on your websites.`);
  return { title: "Baba", lines };
}

// ---------------------------------------------------------------------------
// Build, send, schedule
// ---------------------------------------------------------------------------

export async function buildBriefing(workspaceId: string, timeZone: string): Promise<Briefing> {
  const tz = safeTimeZone(timeZone);
  const { date } = localNow(tz);
  const sections = (
    await Promise.all([
      part("your calendar", () => calendar(workspaceId, tz, date)),
      part("your email", () => inbox(workspaceId)),
      part("your accounting", () => invoices(workspaceId, date)),
      part("your shop", () => shop(workspaceId)),
      activity(workspaceId),
    ])
  ).filter((s): s is BriefingSection => Boolean(s));
  if (sections.length === 1) {
    sections.push({ title: "Tip", lines: ["Connect your email and calendar in Integrations to see your day here."] });
  }
  const summary = sections
    .map((s) => s.lines[0])
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return { heading: `Your briefing for ${formatDay(tz)}`, sections, summary };
}

/** Builds and sends one person's briefing (bell + email). */
export async function sendBriefing(userId: string, workspaceId: string) {
  const db = getSupabaseAdmin();
  const [{ data: profile }, { data: member }] = await Promise.all([
    db.from("profiles").select("email, timezone").eq("id", userId).maybeSingle(),
    db.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
  ]);
  // Viewers don't get it: it shows the workspace's email and money details
  if (!profile || !member || member.role === "viewer") return { sent: false, emailed: false };
  const briefing = await buildBriefing(workspaceId, profile.timezone);
  await notifyInApp([{ userId, workspaceId, kind: "info", title: briefing.heading, body: briefing.summary, link: routes.ask }]);
  const emailed = profile.email ? await sendEmail(briefingEmail({ to: profile.email, heading: briefing.heading, sections: briefing.sections, url: `${serverOrigin()}${routes.ask}` })) : false;
  return { sent: true, emailed };
}

/**
 * Sends the briefings that are due: switched on, past the chosen hour in the person's
 * time zone, and not yet sent today. Each one is claimed first, so it goes out once even
 * with several servers.
 */
export async function runDueBriefings() {
  if (!isAdminConfigured()) return { sent: 0 };
  const db = getSupabaseAdmin();
  const { data: rows } = await db.from("daily_briefings").select("user_id, workspace_id, send_hour, last_sent_on").eq("enabled", true).limit(2000);
  if (!rows?.length) return { sent: 0 };
  const { data: profiles } = await db.from("profiles").select("id, timezone").in("id", [...new Set(rows.map((r) => r.user_id))]);
  const zones = new Map((profiles ?? []).map((p) => [p.id, safeTimeZone(p.timezone)]));
  let sent = 0;
  for (const row of rows) {
    const local = localNow(zones.get(row.user_id) ?? "UTC");
    if (local.hour < row.send_hour || row.last_sent_on === local.date) continue;
    const { data: claimed } = await db
      .from("daily_briefings")
      .update({ last_sent_on: local.date })
      .eq("user_id", row.user_id)
      .eq("workspace_id", row.workspace_id)
      .eq("enabled", true)
      .or(`last_sent_on.is.null,last_sent_on.neq.${local.date}`)
      .select("user_id");
    if (!claimed?.length) continue;
    try {
      if ((await sendBriefing(row.user_id, row.workspace_id)).sent) sent++;
    } catch (error) {
      console.error("[briefing] send failed:", error instanceof Error ? error.message : error);
    }
  }
  return { sent };
}
