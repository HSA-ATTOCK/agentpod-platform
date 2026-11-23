import "server-only";
import type { Email } from "./mailer";

/** Simple, email-client-safe HTML layout (tables + inline styles), with a plain-text twin. */

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout({ heading, paragraphs, button }: { heading: string; paragraphs: string[]; button?: { label: string; url: string } }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${p}</p>`).join("");
  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#a3e635;border-radius:10px">
         <a href="${escape(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none">${escape(button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:12px;color:#71717a">Or copy this link: <a href="${escape(button.url)}" style="color:#4d7c0f;word-break:break-all">${escape(button.url)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
      <tr><td>
        <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0a0a0a">Baba</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0a0a0a">${heading}</h1>
        ${body}${cta}
        <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">You're getting this email because of your Baba account. You can change which emails you get in Settings → Notifications.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

export function inviteEmail(input: { to: string; workspaceName: string; inviterName: string; role: string; url: string }): Email {
  const ws = escape(input.workspaceName);
  return {
    to: input.to,
    subject: `${input.inviterName} invited you to ${input.workspaceName} on Baba`,
    html: layout({
      heading: `Join ${ws} on Baba`,
      paragraphs: [
        `${escape(input.inviterName)} invited you to the <strong>${ws}</strong> workspace as ${ROLE[input.role] ?? input.role}.`,
        "Baba is an AI assistant that researches, writes reports, analyses data and gets work done for your team.",
        "Create your account with this email address and you'll join the workspace automatically. Already have an account? Sign in and accept the invite from the workspace menu.",
      ],
      button: { label: "Accept invite", url: input.url },
    }),
    text: `${input.inviterName} invited you to the ${input.workspaceName} workspace on Baba as ${ROLE[input.role] ?? input.role}.\n\nAccept: ${input.url}\n\nSign up with this email address and you'll join automatically. Already have an account? Sign in and accept the invite from the workspace menu.`,
  };
}

export type TaskEmailKind = "task_finished" | "task_failed" | "paused_at_cap" | "approval_needed";

const TASK_COPY: Record<TaskEmailKind, { subject: string; heading: string; line: string; button: string }> = {
  task_finished: { subject: "Baba finished your task", heading: "Your task is done", line: "Baba has finished working on:", button: "See the result" },
  task_failed: { subject: "Baba couldn't finish your task", heading: "Your task didn't finish", line: "Baba ran into a problem with:", button: "Open the task" },
  paused_at_cap: {
    subject: "Baba paused at your spending cap",
    heading: "Paused at your spending cap",
    line: "Baba reached the spending cap for this conversation while working on:",
    button: "Continue the task",
  },
  approval_needed: { subject: "Baba needs your approval", heading: "Your approval is needed", line: "Baba is waiting for your OK before continuing:", button: "Review and approve" },
};

export function taskEmail(input: { to: string; kind: TaskEmailKind; request: string; url: string; detail?: string }): Email {
  const copy = TASK_COPY[input.kind];
  const request = input.request.length > 300 ? `${input.request.slice(0, 299)}…` : input.request;
  return {
    to: input.to,
    subject: copy.subject,
    html: layout({
      heading: copy.heading,
      paragraphs: [
        copy.line,
        `<em style="color:#0a0a0a">&ldquo;${escape(request)}&rdquo;</em>`,
        ...(input.detail ? [escape(input.detail)] : []),
      ],
      button: { label: copy.button, url: input.url },
    }),
    text: `${copy.heading}\n\n${copy.line}\n"${request}"\n${input.detail ? `\n${input.detail}\n` : ""}\n${copy.button}: ${input.url}`,
  };
}
