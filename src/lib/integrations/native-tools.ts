import "server-only";
import { oauthAccessToken, PROVIDERS, type OAuthProvider } from "./oauth-apps";

/**
 * Tools for Slack, HubSpot and Microsoft 365 (definitions in baba/native-tools.mjs).
 * Reading runs straight away; anything that sends, posts, creates or changes waits for
 * a person's approval (see NATIVE_NEEDS_APPROVAL and custom-tools.ts).
 */

type Input = Record<string, unknown>;
type Result = { text: string; isError: boolean };
const str = (input: Input, key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
const MAX = 30_000;
const cut = (t: string) => (t.length > MAX ? `${t.slice(0, MAX)}\n…[cut off]` : t);

export const NATIVE_TOOL_NAMES = new Set([
  "slack_list_channels",
  "slack_read_channel",
  "slack_post_message",
  "hubspot_search_contacts",
  "hubspot_list_deals",
  "hubspot_create_contact",
  "hubspot_update_contact",
  "outlook_search_mail",
  "outlook_read_mail",
  "outlook_send_mail",
  "outlook_list_events",
  "outlook_create_event",
  "quickbooks_report",
  "quickbooks_query",
  "xero_report",
  "xero_list",
  "shopify_list",
  "shopify_sales_summary",
]);

export const NATIVE_NEEDS_APPROVAL = new Set(["slack_post_message", "hubspot_create_contact", "hubspot_update_contact", "outlook_send_mail", "outlook_create_event"]);

export const NATIVE_LABELS: Record<string, string> = {
  slack_list_channels: "Listing Slack channels",
  slack_read_channel: "Reading a Slack channel",
  slack_post_message: "Posting to Slack",
  hubspot_search_contacts: "Searching HubSpot contacts",
  hubspot_list_deals: "Reading HubSpot deals",
  hubspot_create_contact: "Creating a HubSpot contact",
  hubspot_update_contact: "Updating a HubSpot contact",
  outlook_search_mail: "Searching Outlook mail",
  outlook_read_mail: "Reading an Outlook email",
  outlook_send_mail: "Sending an Outlook email",
  outlook_list_events: "Reading your Outlook calendar",
  outlook_create_event: "Creating an Outlook calendar event",
  quickbooks_report: "Reading a QuickBooks report",
  quickbooks_query: "Reading QuickBooks records",
  xero_report: "Reading a Xero report",
  xero_list: "Reading Xero records",
  shopify_list: "Reading Shopify data",
  shopify_sales_summary: "Adding up Shopify sales",
};

const providerOf = (name: string): OAuthProvider => {
  const prefix = name.split("_")[0];
  return prefix === "outlook" ? "microsoft" : (prefix as OAuthProvider);
};

export function nativeApprovalSummary(name: string, input: Input) {
  switch (name) {
    case "slack_post_message":
      return `Post to ${str(input, "channel")}:\n${str(input, "text")}`;
    case "hubspot_create_contact":
      return `Create contact ${[str(input, "firstname"), str(input, "lastname")].filter(Boolean).join(" ")} <${str(input, "email")}>${str(input, "company") ? `, ${str(input, "company")}` : ""}`;
    case "hubspot_update_contact":
      return `Update contact ${str(input, "contact_id")}: ${JSON.stringify(input.properties ?? {})}`;
    case "outlook_send_mail":
      return `To: ${str(input, "to")}${str(input, "cc") ? `\nCc: ${str(input, "cc")}` : ""}\nSubject: ${str(input, "subject")}\n\n${str(input, "body")}`;
    case "outlook_create_event":
      return `${str(input, "subject")}\n${str(input, "start")} → ${str(input, "end")}${str(input, "time_zone") ? ` (${str(input, "time_zone")})` : ""}${str(input, "attendees") ? `\nInvites (they get an email): ${str(input, "attendees")}` : ""}${str(input, "description") ? `\n\nDescription sent to attendees:\n${str(input, "description")}` : ""}`;
    default:
      return name;
  }
}

class ToolError extends Error {}

async function api(token: string, url: string, init: RequestInit = {}, provider: OAuthProvider) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (res.status === 204) return {};
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    const err = (data.error as { message?: string } | string | undefined) ?? (data.message as string | undefined);
    throw new ToolError(`${PROVIDERS[provider].name} said: ${typeof err === "string" ? err : (err?.message ?? res.status)}`);
  }
  return data;
}

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// ---- Slack ----

async function slackChannelId(token: string, channel: string) {
  const name = channel.replace(/^#/, "");
  if (/^[CG][A-Z0-9]{6,}$/.test(name)) return name;
  const data = (await api(token, "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=1000", {}, "slack")) as {
    channels: { id: string; name: string }[];
  };
  const found = data.channels.find((c) => c.name === name);
  if (!found) throw new ToolError(`No channel called #${name}. Use slack_list_channels.`);
  return found.id;
}

async function slack(name: string, input: Input, token: string): Promise<string> {
  if (name === "slack_list_channels") {
    const data = (await api(token, "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=500", {}, "slack")) as {
      channels: { id: string; name: string; is_member: boolean; num_members?: number; topic?: { value: string } }[];
    };
    return data.channels.map((c) => `- #${c.name} (${c.id})${c.is_member ? "" : " — Baba isn't in this channel; invite it with /invite"}${c.topic?.value ? ` — ${c.topic.value}` : ""}`).join("\n") || "No channels.";
  }
  const channel = await slackChannelId(token, str(input, "channel"));
  if (name === "slack_read_channel") {
    const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));
    const data = (await api(token, `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`, {}, "slack")) as {
      messages: { user?: string; text: string; ts: string; bot_id?: string }[];
    };
    const users = new Map<string, string>();
    for (const id of new Set(data.messages.map((m) => m.user).filter(Boolean) as string[])) {
      try {
        const u = (await api(token, `https://slack.com/api/users.info?user=${id}`, {}, "slack")) as { user: { real_name?: string; name: string } };
        users.set(id, u.user.real_name || u.user.name);
      } catch {
        users.set(id, id);
      }
    }
    return [...data.messages]
      .reverse()
      .map((m) => `[${new Date(Number(m.ts) * 1000).toISOString()}] ${m.user ? users.get(m.user) : "bot"}: ${m.text}`)
      .join("\n") || "No messages.";
  }
  // slack_post_message (approved)
  const text = str(input, "text");
  if (!text) throw new ToolError("Missing text.");
  await api(token, "https://slack.com/api/chat.postMessage", { method: "POST", body: JSON.stringify({ channel, text: text.slice(0, 3000) }) }, "slack");
  return `Posted to ${str(input, "channel")}.`;
}

// ---- HubSpot ----

const CONTACT_PROPS = ["email", "firstname", "lastname", "company", "phone", "jobtitle", "lifecyclestage", "hs_lead_status", "lastmodifieddate"];

async function hubspot(name: string, input: Input, token: string): Promise<string> {
  const base = "https://api.hubapi.com/crm/v3/objects";
  if (name === "hubspot_search_contacts") {
    const data = (await api(token, `${base}/contacts/search`, { method: "POST", body: JSON.stringify({ query: str(input, "query"), limit: Math.min(100, Number(input.limit) || 20), properties: CONTACT_PROPS }) }, "hubspot")) as {
      total: number;
      results: { id: string; properties: Record<string, string | null> }[];
    };
    return `${data.total} contact(s).\n` + data.results.map((c) => `- id ${c.id}: ${CONTACT_PROPS.map((p) => (c.properties[p] ? `${p}=${c.properties[p]}` : "")).filter(Boolean).join(", ")}`).join("\n");
  }
  if (name === "hubspot_list_deals") {
    const data = (await api(token, `${base}/deals?limit=${Math.min(100, Number(input.limit) || 50)}&properties=dealname,amount,dealstage,closedate,pipeline`, {}, "hubspot")) as {
      results: { id: string; properties: Record<string, string | null> }[];
    };
    return data.results.map((d) => `- id ${d.id}: ${d.properties.dealname} — amount ${d.properties.amount ?? "?"}, stage ${d.properties.dealstage}, close ${d.properties.closedate ?? "?"}`).join("\n") || "No deals.";
  }
  if (name === "hubspot_create_contact") {
    const properties: Record<string, string> = {};
    for (const p of ["email", "firstname", "lastname", "company", "phone", "jobtitle"]) if (str(input, p)) properties[p] = str(input, p);
    if (!properties.email) throw new ToolError("An email is required.");
    const data = (await api(token, `${base}/contacts`, { method: "POST", body: JSON.stringify({ properties }) }, "hubspot")) as { id: string };
    return `Created contact ${data.id}.`;
  }
  // hubspot_update_contact (approved)
  const props = (input.properties && typeof input.properties === "object" ? input.properties : {}) as Record<string, unknown>;
  const properties = Object.fromEntries(Object.entries(props).filter(([k, v]) => /^[a-z0-9_]{1,60}$/.test(k) && typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 1000)]));
  await api(token, `${base}/contacts/${encodeURIComponent(str(input, "contact_id"))}`, { method: "PATCH", body: JSON.stringify({ properties }) }, "hubspot");
  return `Updated contact ${str(input, "contact_id")}.`;
}

// ---- Microsoft 365 ----

const recipients = (list: string) =>
  list
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    .map((address) => ({ emailAddress: { address } }));

async function microsoft(name: string, input: Input, token: string): Promise<string> {
  const graph = "https://graph.microsoft.com/v1.0/me";
  if (name === "outlook_search_mail") {
    const top = Math.min(50, Number(input.top) || 15);
    const q = str(input, "query");
    const url = q
      ? `${graph}/messages?$search=${encodeURIComponent(`"${q.replace(/"/g, "")}"`)}&$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview`
      : `${graph}/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview`;
    const data = (await api(token, url, {}, "microsoft")) as { value: { id: string; subject: string; from?: { emailAddress: { address: string; name: string } }; receivedDateTime: string; bodyPreview: string }[] };
    return data.value.map((m) => `- id ${m.id}\n  ${m.receivedDateTime} from ${m.from?.emailAddress.name} <${m.from?.emailAddress.address}>\n  ${m.subject}\n  ${m.bodyPreview}`).join("\n") || "No emails found.";
  }
  if (name === "outlook_read_mail") {
    const m = (await api(token, `${graph}/messages/${encodeURIComponent(str(input, "message_id"))}?$select=subject,from,toRecipients,ccRecipients,receivedDateTime,body`, {}, "microsoft")) as {
      subject: string;
      from?: { emailAddress: { address: string } };
      toRecipients: { emailAddress: { address: string } }[];
      receivedDateTime: string;
      body: { contentType: string; content: string };
    };
    const body = m.body.contentType === "html" ? stripHtml(m.body.content) : m.body.content;
    return `From: ${m.from?.emailAddress.address}\nTo: ${m.toRecipients.map((r) => r.emailAddress.address).join(", ")}\nDate: ${m.receivedDateTime}\nSubject: ${m.subject}\n\n${body}`;
  }
  if (name === "outlook_send_mail") {
    const to = recipients(str(input, "to"));
    if (!to.length) throw new ToolError("Give at least one valid recipient email.");
    await api(
      token,
      `${graph}/sendMail`,
      { method: "POST", body: JSON.stringify({ message: { subject: str(input, "subject").slice(0, 300), body: { contentType: "Text", content: str(input, "body") }, toRecipients: to, ccRecipients: recipients(str(input, "cc")) }, saveToSentItems: true }) },
      "microsoft",
    );
    return `Sent to ${to.map((r) => r.emailAddress.address).join(", ")}.`;
  }
  if (name === "outlook_list_events") {
    const days = Math.min(60, Math.max(1, Number(input.days) || 7));
    const start = new Date().toISOString();
    const end = new Date(Date.now() + days * 86_400_000).toISOString();
    const data = (await api(token, `${graph}/calendarView?startDateTime=${start}&endDateTime=${end}&$top=100&$orderby=start/dateTime&$select=subject,start,end,location,attendees,isOnlineMeeting`, {}, "microsoft")) as {
      value: { subject: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string }; location?: { displayName: string }; attendees: { emailAddress: { address: string } }[] }[];
    };
    return data.value.map((e) => `- ${e.start.dateTime} → ${e.end.dateTime} (${e.start.timeZone}) ${e.subject}${e.location?.displayName ? ` @ ${e.location.displayName}` : ""}${e.attendees.length ? ` with ${e.attendees.map((a) => a.emailAddress.address).join(", ")}` : ""}`).join("\n") || `No events in the next ${days} days.`;
  }
  // outlook_create_event (approved)
  const timeZone = str(input, "time_zone") || "UTC";
  const event = (await api(
    token,
    `${graph}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        subject: str(input, "subject").slice(0, 255),
        body: { contentType: "Text", content: str(input, "description") },
        start: { dateTime: str(input, "start"), timeZone },
        end: { dateTime: str(input, "end"), timeZone },
        attendees: recipients(str(input, "attendees")).map((r) => ({ ...r, type: "required" })),
      }),
    },
    "microsoft",
  )) as { id: string; webLink?: string };
  return `Event created${event.webLink ? `: ${event.webLink}` : "."}`;
}

// ---- QuickBooks and Xero (read-only by design: no payments, transfers or journal changes) ----

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateParam = (input: Input, key: string) => {
  const v = str(input, key);
  if (v && !DATE.test(v)) throw new ToolError(`${key} must be YYYY-MM-DD.`);
  return v;
};

type QboRow = { ColData?: { value: string }[]; Header?: { ColData: { value: string }[] }; Rows?: { Row?: QboRow[] }; Summary?: { ColData: { value: string }[] }; type?: string };

function flattenQbo(rows: QboRow[] | undefined, depth = 0): string[] {
  const out: string[] = [];
  for (const row of rows ?? []) {
    const pad = "  ".repeat(depth);
    if (row.Header) out.push(pad + row.Header.ColData.map((c) => c.value).filter(Boolean).join(" | "));
    if (row.ColData) out.push(pad + row.ColData.map((c) => c.value).join(" | "));
    if (row.Rows?.Row) out.push(...flattenQbo(row.Rows.Row, depth + 1));
    if (row.Summary) out.push(pad + row.Summary.ColData.map((c) => c.value).join(" | "));
  }
  return out;
}

async function quickbooks(name: string, input: Input, token: string, config: Record<string, string>): Promise<string> {
  const base = `${config.base ?? "https://quickbooks.api.intuit.com"}/v3/company/${config.realmId}`;
  if (name === "quickbooks_report") {
    const report = str(input, "report") || "ProfitAndLoss";
    if (!/^(ProfitAndLoss|ProfitAndLossDetail|BalanceSheet|CashFlow|AgedReceivables|AgedPayables|CustomerSales|ItemSales|VendorExpenses|TrialBalance)$/.test(report)) {
      throw new ToolError("Unknown report.");
    }
    const params = new URLSearchParams({ minorversion: "75" });
    const start = dateParam(input, "start_date");
    const end = dateParam(input, "end_date");
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    if (str(input, "summarize_by")) params.set("summarize_column_by", str(input, "summarize_by"));
    const data = (await api(token, `${base}/reports/${report}?${params}`, { headers: { Accept: "application/json" } }, "quickbooks")) as {
      Header?: { ReportName?: string; StartPeriod?: string; EndPeriod?: string; Currency?: string };
      Columns?: { Column?: { ColTitle: string }[] };
      Rows?: { Row?: QboRow[] };
    };
    const head = data.Header ?? {};
    const cols = (data.Columns?.Column ?? []).map((c) => c.ColTitle || "").join(" | ");
    return `${head.ReportName ?? report} ${head.StartPeriod ?? ""} to ${head.EndPeriod ?? ""} (${head.Currency ?? ""}) — figures as recorded in QuickBooks\n${cols}\n${flattenQbo(data.Rows?.Row).join("\n")}`;
  }
  // quickbooks_query: QuickBooks' query language is read-only (SELECT only)
  const query = str(input, "query");
  if (!/^select\s/i.test(query) || /;/.test(query)) throw new ToolError('Only one "SELECT … FROM …" query is allowed, e.g. SELECT * FROM Invoice WHERE Balance > \'0\' MAXRESULTS 50.');
  const data = (await api(token, `${base}/query?minorversion=75&query=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } }, "quickbooks")) as { QueryResponse?: Record<string, unknown> };
  return JSON.stringify(data.QueryResponse ?? {}, null, 1);
}

type XeroRow = { RowType: string; Title?: string; Cells?: { Value: string }[]; Rows?: XeroRow[] };
function flattenXero(rows: XeroRow[] | undefined, depth = 0): string[] {
  const out: string[] = [];
  for (const row of rows ?? []) {
    const pad = "  ".repeat(depth);
    if (row.Title) out.push(pad + row.Title);
    if (row.Cells) out.push(pad + row.Cells.map((c) => c.Value).join(" | "));
    if (row.Rows) out.push(...flattenXero(row.Rows, depth + 1));
  }
  return out;
}

async function xero(name: string, input: Input, token: string, config: Record<string, string>): Promise<string> {
  const headers = { "xero-tenant-id": config.tenantId, Accept: "application/json" };
  if (name === "xero_report") {
    const report = str(input, "report") || "ProfitAndLoss";
    if (!/^(ProfitAndLoss|BalanceSheet|TrialBalance|BankSummary|ExecutiveSummary|BudgetSummary)$/.test(report)) throw new ToolError("Unknown report.");
    const params = new URLSearchParams();
    const from = dateParam(input, "from_date");
    const to = dateParam(input, "to_date");
    if (from) params.set(report === "BalanceSheet" || report === "TrialBalance" ? "date" : "fromDate", from);
    if (to && report !== "BalanceSheet" && report !== "TrialBalance") params.set("toDate", to);
    const data = (await api(token, `https://api.xero.com/api.xro/2.0/Reports/${report}?${params}`, { headers }, "xero")) as {
      Reports?: { ReportName: string; ReportDate?: string; ReportTitles?: string[]; Rows?: XeroRow[] }[];
    };
    const r = data.Reports?.[0];
    if (!r) return "No report.";
    return `${(r.ReportTitles ?? [r.ReportName]).join(" — ")} — figures as recorded in Xero\n${flattenXero(r.Rows).join("\n")}`;
  }
  // xero_list
  const type = str(input, "type") || "Invoices";
  if (!/^(Invoices|Contacts|Accounts|BankTransactions|Payments|CreditNotes|Items)$/.test(type)) throw new ToolError("Unknown record type.");
  const params = new URLSearchParams({ page: String(Math.max(1, Number(input.page) || 1)) });
  if (str(input, "where")) params.set("where", str(input, "where"));
  if (str(input, "order")) params.set("order", str(input, "order"));
  const data = (await api(token, `https://api.xero.com/api.xro/2.0/${type}?${params}`, { headers }, "xero")) as Record<string, unknown>;
  return JSON.stringify(data[type] ?? data, null, 1);
}

// ---- Shopify (read-only Admin GraphQL; fixed queries, no mutations) ----

const SHOPIFY_QUERIES: Record<string, string> = {
  orders: `query($first:Int!,$q:String){orders(first:$first,query:$q,sortKey:CREATED_AT,reverse:true){nodes{name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet{shopMoney{amount currencyCode}} customer{displayName email} lineItems(first:10){nodes{title quantity}}}}}`,
  products: `query($first:Int!,$q:String){products(first:$first,query:$q,sortKey:UPDATED_AT,reverse:true){nodes{title status totalInventory productType vendor priceRangeV2{minVariantPrice{amount currencyCode} maxVariantPrice{amount}}}}}`,
  customers: `query($first:Int!,$q:String){customers(first:$first,query:$q,sortKey:UPDATED_AT,reverse:true){nodes{displayName email numberOfOrders amountSpent{amount currencyCode} createdAt}}}`,
  inventory: `query($first:Int!,$q:String){productVariants(first:$first,query:$q){nodes{displayName sku inventoryQuantity product{title status}}}}`,
};

async function shopifyGraphql(token: string, shop: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: Record<string, { nodes: unknown[] }>; errors?: { message: string }[] | string };
  if (!res.ok || data.errors) throw new ToolError(`Shopify said: ${typeof data.errors === "string" ? data.errors : (data.errors?.[0]?.message ?? res.status)}`);
  return data.data ?? {};
}

async function shopify(name: string, input: Input, token: string, config: Record<string, string>): Promise<string> {
  if (name === "shopify_list") {
    const resource = str(input, "resource") || "orders";
    const query = SHOPIFY_QUERIES[resource];
    if (!query) throw new ToolError("resource must be orders, products, customers or inventory.");
    const data = await shopifyGraphql(token, config.shop, query, { first: Math.min(100, Number(input.first) || 25), q: str(input, "query") || null });
    return JSON.stringify(Object.values(data)[0]?.nodes ?? [], null, 1);
  }
  // shopify_sales_summary: totals for the last N days (up to 250 orders per page, 4 pages)
  const days = Math.min(365, Math.max(1, Number(input.days) || 30));
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  let total = 0;
  let count = 0;
  let currency = "";
  let cursor: string | null = null;
  for (let page = 0; page < 4; page++) {
    const data = (await shopifyGraphql(
      token,
      config.shop,
      `query($c:String,$q:String){orders(first:250,after:$c,query:$q){pageInfo{hasNextPage endCursor} nodes{totalPriceSet{shopMoney{amount currencyCode}}}}}`,
      { c: cursor, q: `created_at:>=${since} -status:cancelled` },
    )) as unknown as { orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: { totalPriceSet: { shopMoney: { amount: string; currencyCode: string } } }[] } };
    for (const o of data.orders.nodes) {
      total += Number(o.totalPriceSet.shopMoney.amount);
      currency = o.totalPriceSet.shopMoney.currencyCode;
      count++;
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return `Last ${days} days (since ${since}): ${count} orders, ${total.toFixed(2)} ${currency} total (order totals incl. tax and shipping, excluding cancelled)${count >= 1000 ? ". Only the latest 1,000 orders were counted." : "."}`;
}

export async function runNativeTool(name: string, input: Input, scope: { workspaceId: string }): Promise<Result> {
  const provider = providerOf(name);
  try {
    const auth = await oauthAccessToken(scope.workspaceId, provider, str(input, "account") || undefined);
    if (!auth) {
      return {
        text: `${PROVIDERS[provider].name} isn't connected (or needs reconnecting). Call request_connection with service "${provider}" so the user gets a Connect button.`,
        isError: true,
      };
    }
    const runners = { slack, hubspot, microsoft, quickbooks, xero, shopify } as const;
    const output = await runners[provider](name, input, auth.token, auth.config);
    return { text: cut(`[${PROVIDERS[provider].name} account: ${auth.label}]\n${output}`), isError: false };
  } catch (error) {
    return { text: error instanceof Error ? error.message : "That didn't work.", isError: true };
  }
}
