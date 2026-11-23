import "server-only";
import { getClaude } from "@/lib/baba/server";
import { googleAccessToken } from "./oauth";

/**
 * Runs Baba's Google tools (defined in baba/google-tools.mjs) with the workspace's token.
 * Every function returns plain text for Claude to read.
 */

export const GOOGLE_TOOL_NAMES = new Set([
  "gmail_search",
  "gmail_read",
  "gmail_create_draft",
  "gmail_send",
  "drive_search",
  "drive_read",
  "drive_save_output",
  "calendar_list_events",
  "calendar_create_event",
]);

/** Tools that change something outside Baba and must be approved first. */
export const NEEDS_APPROVAL = new Set(["gmail_send", "calendar_create_event"]);

type Input = Record<string, unknown>;
export type ToolContext = { workspaceId: string; sessionId: string };

const MAX_TEXT = 40_000;

class ToolError extends Error {}

function str(input: Input, key: string, required = false) {
  const value = input[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new ToolError(`Missing "${key}".`);
  return undefined;
}

function int(input: Input, key: string, fallback: number, max: number) {
  const value = Number(input[key]);
  return Number.isFinite(value) && value >= 1 ? Math.min(Math.floor(value), max) : fallback;
}

function cut(text: string) {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n…[cut off: ${text.length - MAX_TEXT} more characters]` : text;
}

async function google(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 403 && /insufficient|scope/i.test(detail)) {
      throw new ToolError("Google didn't allow this. Reconnect Google in Integrations and accept all the permissions.");
    }
    throw new ToolError(`Google returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response;
}

// ---- Gmail ----

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; filename?: string; body?: { data?: string; size?: number }; parts?: GmailPart[]; headers?: GmailHeader[] };

const header = (headers: GmailHeader[] | undefined, name: string) =>
  headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

function decodeBase64Url(data: string) {
  return Buffer.from(data, "base64url").toString("utf8");
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageText(part: GmailPart): { text: string; attachments: string[] } {
  const attachments: string[] = [];
  let plain = "";
  let html = "";
  const walk = (p: GmailPart) => {
    if (p.filename) attachments.push(p.filename);
    else if (p.mimeType === "text/plain" && p.body?.data && !plain) plain = decodeBase64Url(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeBase64Url(p.body.data);
    p.parts?.forEach(walk);
  };
  walk(part);
  return { text: plain || htmlToText(html), attachments };
}

function encodeHeader(value: string) {
  // RFC 2047 for non-ASCII subjects
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

async function buildRawEmail(token: string, input: Input) {
  const to = str(input, "to", true)!;
  const subject = str(input, "subject", true)!;
  const body = str(input, "body", true)!;
  const cc = str(input, "cc");
  const replyTo = str(input, "in_reply_to_message_id");
  const lines = [`To: ${to}`, ...(cc ? [`Cc: ${cc}`] : []), `Subject: ${encodeHeader(subject)}`];
  let threadId: string | undefined;
  if (replyTo) {
    const original = (await (
      await google(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(replyTo)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`)
    ).json()) as { threadId: string; payload?: { headers?: GmailHeader[] } };
    threadId = original.threadId;
    const messageId = header(original.payload?.headers, "Message-ID");
    const references = header(original.payload?.headers, "References");
    if (messageId) lines.push(`In-Reply-To: ${messageId}`, `References: ${[references, messageId].filter(Boolean).join(" ")}`);
  }
  lines.push("MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: 8bit", "", body);
  return { raw: Buffer.from(lines.join("\r\n")).toString("base64url"), threadId, to, subject };
}

async function gmailSearch(token: string, input: Input) {
  const q = str(input, "query", true)!;
  const max = int(input, "max_results", 10, 25);
  const list = (await (
    await google(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`)
  ).json()) as { messages?: { id: string }[] };
  if (!list.messages?.length) return `No emails match "${q}".`;
  const rows = await Promise.all(
    list.messages.map(async ({ id }) => {
      const m = (await (
        await google(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
      ).json()) as { id: string; threadId: string; snippet: string; labelIds?: string[]; payload?: { headers?: GmailHeader[] } };
      const h = m.payload?.headers;
      return `- id: ${m.id}\n  from: ${header(h, "From")}\n  to: ${header(h, "To")}\n  subject: ${header(h, "Subject")}\n  date: ${header(h, "Date")}${m.labelIds?.includes("UNREAD") ? "\n  unread: yes" : ""}\n  snippet: ${m.snippet}`;
    }),
  );
  return `${rows.length} email(s):\n${rows.join("\n")}`;
}

async function gmailRead(token: string, input: Input) {
  const id = str(input, "message_id", true)!;
  const m = (await (await google(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`)).json()) as {
    threadId: string;
    payload: GmailPart;
  };
  const h = m.payload.headers;
  const { text, attachments } = messageText(m.payload);
  return cut(
    [
      `From: ${header(h, "From")}`,
      `To: ${header(h, "To")}`,
      header(h, "Cc") ? `Cc: ${header(h, "Cc")}` : "",
      `Subject: ${header(h, "Subject")}`,
      `Date: ${header(h, "Date")}`,
      `Thread id: ${m.threadId}`,
      attachments.length ? `Attachments: ${attachments.join(", ")}` : "",
      "",
      text || "(no text content)",
    ]
      .filter((line, i) => line !== "" || i === 7)
      .join("\n"),
  );
}

async function gmailCreateDraft(token: string, input: Input) {
  const { raw, threadId, to, subject } = await buildRawEmail(token, input);
  const draft = (await (
    await google(token, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { raw, ...(threadId ? { threadId } : {}) } }),
    })
  ).json()) as { id: string };
  return `Draft saved in Gmail (not sent): to ${to}, subject "${subject}". Draft id: ${draft.id}. The user can review and send it from Gmail's Drafts folder.`;
}

async function gmailSend(token: string, input: Input) {
  const { raw, threadId, to, subject } = await buildRawEmail(token, input);
  const sent = (await (
    await google(token, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
    })
  ).json()) as { id: string };
  return `Email sent to ${to} (subject "${subject}"). Message id: ${sent.id}.`;
}

// ---- Drive ----

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES = "application/vnd.google-apps.presentation";

async function driveSearch(token: string, input: Input) {
  const words = str(input, "query", true)!.replace(/['\\]/g, " ");
  const max = int(input, "max_results", 10, 25);
  const q = `(name contains '${words}' or fullText contains '${words}') and trashed = false`;
  const data = (await (
    await google(
      token,
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${max}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    )
  ).json()) as { files: { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string }[] };
  if (!data.files.length) return `No Drive files match "${words}".`;
  return `${data.files.length} file(s):\n${data.files
    .map((f) => `- id: ${f.id}\n  name: ${f.name}\n  type: ${f.mimeType}\n  modified: ${f.modifiedTime}\n  link: ${f.webViewLink}`)
    .join("\n")}`;
}

async function driveRead(token: string, input: Input) {
  const id = encodeURIComponent(str(input, "file_id", true)!);
  const meta = (await (await google(token, `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType,size&supportsAllDrives=true`)).json()) as {
    name: string;
    mimeType: string;
    size?: string;
  };
  let url: string;
  if (meta.mimeType === GOOGLE_DOC || meta.mimeType === GOOGLE_SLIDES) {
    url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`;
  } else if (meta.mimeType === GOOGLE_SHEET) {
    url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/csv`;
  } else if (/^text\/|json|csv|xml/.test(meta.mimeType)) {
    if (Number(meta.size ?? 0) > 2_000_000) return `"${meta.name}" is too large to read here (over 2 MB).`;
    url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
  } else {
    return `"${meta.name}" is a ${meta.mimeType} file, which can't be read as text here. Ask the user to download it and attach it in Ask Baba.`;
  }
  const text = await (await google(token, url)).text();
  return cut(`File: ${meta.name} (${meta.mimeType})\n\n${text}`);
}

async function driveSaveOutput(token: string, input: Input, ctx: ToolContext) {
  const fileName = str(input, "file_name", true)!.split("/").pop()!;
  const folderId = str(input, "folder_id");
  const claude = getClaude();
  const files = await claude.beta.files.list({ scope_id: ctx.sessionId, betas: ["managed-agents-2026-04-01"] });
  const file = files.data.find((f) => f.filename === fileName);
  if (!file) {
    return `No finished file called "${fileName}" was found. Save it to /mnt/session/outputs/ first (exact name), then try again. Files there: ${files.data.map((f) => f.filename).join(", ") || "none yet"}.`;
  }
  const download = await claude.beta.files.download(file.id);
  const bytes = Buffer.from(await download.arrayBuffer());
  const mimeType = file.mime_type || "application/octet-stream";

  const boundary = `baba${Date.now()}`;
  const metadata = JSON.stringify({ name: fileName, ...(folderId ? { parents: [folderId] } : {}) });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const created = (await (
    await google(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    })
  ).json()) as { id: string; name: string; webViewLink: string };
  return `Saved "${created.name}" to Google Drive: ${created.webViewLink}`;
}

// ---- Calendar ----

type CalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  attendees?: { email: string }[];
  htmlLink?: string;
};

async function calendarList(token: string, input: Input) {
  const params = new URLSearchParams({
    timeMin: new Date(str(input, "time_min", true)!).toISOString(),
    timeMax: new Date(str(input, "time_max", true)!).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(int(input, "max_results", 20, 50)),
  });
  const q = str(input, "query");
  if (q) params.set("q", q);
  const data = (await (await google(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`)).json()) as {
    items: CalendarEvent[];
    timeZone?: string;
  };
  if (!data.items.length) return `No events in that time (calendar timezone: ${data.timeZone ?? "unknown"}).`;
  return `${data.items.length} event(s) (calendar timezone: ${data.timeZone ?? "unknown"}):\n${data.items
    .map(
      (e) =>
        `- ${e.summary ?? "(no title)"}\n  start: ${e.start?.dateTime ?? e.start?.date}\n  end: ${e.end?.dateTime ?? e.end?.date}${e.location ? `\n  location: ${e.location}` : ""}${e.attendees?.length ? `\n  attendees: ${e.attendees.map((a) => a.email).join(", ")}` : ""}`,
    )
    .join("\n")}`;
}

async function calendarCreate(token: string, input: Input) {
  const attendees = (str(input, "attendees") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((emailAddress) => ({ email: emailAddress }));
  const event = (await (
    await google(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${attendees.length ? "all" : "none"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: str(input, "summary", true),
        description: str(input, "description"),
        location: str(input, "location"),
        start: { dateTime: new Date(str(input, "start", true)!).toISOString() },
        end: { dateTime: new Date(str(input, "end", true)!).toISOString() },
        attendees,
      }),
    })
  ).json()) as CalendarEvent;
  return `Event created: "${event.summary}" ${event.start?.dateTime} → ${event.end?.dateTime}. ${event.htmlLink ?? ""}`;
}

// ---- Dispatch ----

/** Short description of a sensitive call, for the approval card and email. */
export function approvalSummary(name: string, input: Input) {
  const s = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  if (name === "gmail_send") {
    const body = s("body");
    return `Send an email\nTo: ${s("to")}${s("cc") ? `\nCc: ${s("cc")}` : ""}\nSubject: ${s("subject")}\n\n${body.length > 1200 ? `${body.slice(0, 1200)}…` : body}`;
  }
  if (name === "calendar_create_event") {
    return `Create a calendar event\n${s("summary")}\n${s("start")} → ${s("end")}${s("attendees") ? `\nInvite: ${s("attendees")}` : ""}${s("location") ? `\nWhere: ${s("location")}` : ""}`;
  }
  return JSON.stringify(input).slice(0, 1200);
}

export const TOOL_LABELS: Record<string, string> = {
  gmail_search: "Searching Gmail",
  gmail_read: "Reading an email",
  gmail_create_draft: "Saving a Gmail draft",
  gmail_send: "Sending an email",
  drive_search: "Searching Google Drive",
  drive_read: "Reading a Drive file",
  drive_save_output: "Saving to Google Drive",
  calendar_list_events: "Checking the calendar",
  calendar_create_event: "Creating a calendar event",
};

/** Runs a Google tool. Returns { text, isError } for Claude. */
export async function runGoogleTool(name: string, input: Input, ctx: ToolContext): Promise<{ text: string; isError: boolean }> {
  try {
    const token = await googleAccessToken(ctx.workspaceId);
    if (!token) {
      return {
        text: "Google isn't connected for this workspace. Tell the user to connect it: Integrations → Google → Connect.",
        isError: true,
      };
    }
    switch (name) {
      case "gmail_search":
        return { text: await gmailSearch(token, input), isError: false };
      case "gmail_read":
        return { text: await gmailRead(token, input), isError: false };
      case "gmail_create_draft":
        return { text: await gmailCreateDraft(token, input), isError: false };
      case "gmail_send":
        return { text: await gmailSend(token, input), isError: false };
      case "drive_search":
        return { text: await driveSearch(token, input), isError: false };
      case "drive_read":
        return { text: await driveRead(token, input), isError: false };
      case "drive_save_output":
        return { text: await driveSaveOutput(token, input, ctx), isError: false };
      case "calendar_list_events":
        return { text: await calendarList(token, input), isError: false };
      case "calendar_create_event":
        return { text: await calendarCreate(token, input), isError: false };
      default:
        return { text: `Unknown tool "${name}".`, isError: true };
    }
  } catch (error) {
    return { text: error instanceof Error ? error.message : String(error), isError: true };
  }
}
