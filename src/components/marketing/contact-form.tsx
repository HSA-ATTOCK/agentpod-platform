"use client";

import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";

type Fields = { name: string; email: string; company: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: "", email: "", company: "", message: "" };
const MESSAGE_MAX = 5000;

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  if (!fields.name.trim()) errors.name = "Please enter your name.";
  else if (fields.name.trim().length > 100) errors.name = "Please keep your name under 100 characters.";
  if (!isValidEmail(fields.email)) errors.email = "Please enter a valid email address.";
  if (fields.company.trim().length > 120) errors.company = "Please keep the company name under 120 characters.";
  if (fields.message.trim().length < 10) errors.message = "Please write a little more (at least 10 characters).";
  else if (fields.message.length > MESSAGE_MAX) errors.message = `Please keep your message under ${MESSAGE_MAX} characters.`;
  return errors;
}

/** The public contact form. Sends JSON to /api/contact. */
export function ContactForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (key: keyof Fields) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus();
      return;
    }

    setStatus("sending");
    setServerError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, website: honeypot.current?.value ?? "" }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
      setFields(EMPTY);
    } catch {
      setServerError("We couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Message sent">
          Thanks for getting in touch. We&apos;ll reply to your email as soon as we can.
        </Alert>
        <Button variant="secondary" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Contact form">
      {status === "error" && serverError && (
        <Alert variant="error" title="Message not sent">
          {serverError}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          id="contact-name"
          label="Name"
          required
          autoComplete="name"
          maxLength={100}
          value={fields.name}
          onChange={(e) => update("name")(e.target.value)}
          error={errors.name}
        />
        <Input
          id="contact-email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={fields.email}
          onChange={(e) => update("email")(e.target.value)}
          error={errors.email}
        />
      </div>

      <Input
        id="contact-company"
        label="Company (optional)"
        autoComplete="organization"
        maxLength={120}
        value={fields.company}
        onChange={(e) => update("company")(e.target.value)}
        error={errors.company}
      />

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold text-muted">
          Message
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        </label>
        <textarea
          id="contact-message"
          rows={6}
          required
          maxLength={MESSAGE_MAX}
          value={fields.message}
          onChange={(e) => update("message")(e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          placeholder="Tell us about your business and what you'd like Baba to help with."
          className={cn(
            "w-full rounded-control border bg-surface-raised p-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
            errors.message ? "border-danger" : "border-border",
          )}
        />
        <FieldError id="contact-message-error" message={errors.message} />
      </div>

      {/* Honeypot: hidden from people and screen readers, filled in only by bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input ref={honeypot} id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" loading={status === "sending"} loadingText="Sending…" className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
