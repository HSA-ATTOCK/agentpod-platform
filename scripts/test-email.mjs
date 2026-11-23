// Sends one test email with the Gmail settings in .env.local.
// Usage: npm run email:test -- you@example.com
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
});

try {
  await transporter.verify();
  console.log(`✓ Signed in to Gmail as ${process.env.GMAIL_USER}`);
  const info = await transporter.sendMail({
    from: { name: process.env.EMAIL_FROM_NAME || "Baba", address: process.env.GMAIL_USER },
    to,
    subject: "Baba test email",
    text: "If you can read this, Baba can send email through your Gmail account.",
  });
  console.log(`✓ Sent to ${to} (message id ${info.messageId}). Check the inbox and the spam folder.`);
} catch (error) {
  console.error("✗ Failed:", error.message);
  if (/Invalid login|Username and Password not accepted|535/.test(error.message)) {
    console.error("  → Use a Google *App password* (16 letters), not your normal Gmail password,");
    console.error("    and make sure GMAIL_USER is the same Gmail account that created it.");
  }
  process.exit(1);
}
