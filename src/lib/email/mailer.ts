import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sends email through your Gmail account (SMTP) with Nodemailer.
 * Needs in .env.local:
 *   GMAIL_USER=you@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (Google Account → Security → App passwords)
 * Optional: EMAIL_FROM_NAME (default "Baba").
 * When these aren't set, emails are skipped and the app keeps working.
 */

let transporter: Transporter | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      // App passwords are shown with spaces; Gmail accepts them without
      pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""),
    },
  });
  return transporter;
}

export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string };

/** Sends one email. Returns false (and logs) instead of throwing, so a mail problem never breaks a page. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const name = process.env.EMAIL_FROM_NAME || "Baba";
    await getTransporter().sendMail({
      from: { name, address: process.env.GMAIL_USER! },
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (error) {
    console.error("[email] sending failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** The app's public address for links in emails. */
export function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }
  return new URL(request.url).origin;
}
