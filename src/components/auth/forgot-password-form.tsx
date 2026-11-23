"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, type AuthResult } from "@/lib/auth/client";
import { isValidEmail } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  function validate(value: string) {
    if (!value.trim()) return "Enter your work email.";
    if (!isValidEmail(value)) return "Enter a valid email address.";
    return undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const nextError = validate(email);
    setError(nextError);
    if (nextError) {
      document.getElementById("email")?.focus();
      return;
    }

    setLoading(true);
    const response = await requestPasswordReset(email);
    setLoading(false);
    setResult(response);
    if (response.ok) setEmail("");
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {result?.ok && (
        <Alert variant="success" title="Check your email" className="mb-2">
          If an account exists for that email, we&apos;ve sent a reset link.
        </Alert>
      )}
      {result && !result.ok && <Alert variant="error">{result.error}</Alert>}

      <Input
        id="email"
        type="email"
        label="Work email"
        placeholder="name@company.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setError(validate(email))}
        error={error}
      />

      <Button type="submit" fullWidth loading={loading} loadingText="Sending link…" className="mt-2 h-11">
        Send reset link
      </Button>
    </form>
  );
}
