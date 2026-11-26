import { clientIp } from "@/lib/rate-limit";
import { isEmailConfigured, sendEmail } from "@/lib/email/mailer";
import { contactEmail } from "@/lib/email/templates";
import { isValidEmail } from "@/lib/validation";

const LIMITS = { name: 100, email: 254, company: 120, messageMin: 10, messageMax: 5000 };

// Simple per-server rate limit: 5 messages per IP every 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()) {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  // Keep the map from growing without end
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}


/** One line of text: trims and collapses whitespace (no line breaks in names or email subjects). */
const singleLine = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const error = (message: string, status: number) => Response.json({ ok: false, error: message }, { status });

/**
 * POST /api/contact — the public website's contact form.
 * Body: { name, email, company?, message, website? }  (`website` is a honeypot and must stay empty)
 * Emails the message to CONTACT_EMAIL (or GMAIL_USER) with Reply-To set to the sender.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return error("Something went wrong. Please try again.", 400);

  // Bots fill in every field; people never see this one. Pretend it worked.
  if (typeof body.website === "string" && body.website.trim() !== "") return Response.json({ ok: true });

  if (rateLimited(clientIp(request))) {
    return error("You've sent several messages in a short time. Please wait a few minutes and try again.", 429);
  }

  const name = singleLine(body.name);
  const email = singleLine(body.email).toLowerCase();
  const company = singleLine(body.company);
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name) return error("Please enter your name.", 400);
  if (name.length > LIMITS.name) return error(`Please keep your name under ${LIMITS.name} characters.`, 400);
  if (!email || email.length > LIMITS.email || !isValidEmail(email)) {
    return error("Please enter a valid email address.", 400);
  }
  if (company.length > LIMITS.company) {
    return error(`Please keep the company name under ${LIMITS.company} characters.`, 400);
  }
  if (message.length < LIMITS.messageMin) {
    return error(`Please write a little more (at least ${LIMITS.messageMin} characters).`, 400);
  }
  if (message.length > LIMITS.messageMax) {
    return error(`Please keep your message under ${LIMITS.messageMax} characters.`, 400);
  }

  const to = process.env.CONTACT_EMAIL || process.env.GMAIL_USER;
  if (!to || !isEmailConfigured()) {
    return error("Contact form isn't set up yet — email us instead.", 503);
  }

  const sent = await sendEmail(contactEmail({ to, name, email, company: company || undefined, message }));
  if (!sent) return error("We couldn't send your message right now. Please try again later or email us.", 502);

  return Response.json({ ok: true });
}
