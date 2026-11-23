"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyTwoFactorCode, type AuthResult } from "@/lib/auth/client";
import { safeNext } from "@/lib/auth/safe-next";

/** Asks for the 6-digit code from the authenticator app after the password. */
export function TwoFactorForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Enter the 6-digit code from your authenticator app.");
      document.getElementById("code")?.focus();
      return;
    }
    setError(undefined);
    setLoading(true);
    const response = await verifyTwoFactorCode(clean);
    if (response.ok) {
      window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
      return;
    }
    setResult(response);
    setCode("");
    setLoading(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {result && !result.ok && <Alert variant="error">{result.error}</Alert>}
      <Input
        id="code"
        label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="123456"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={error}
      />
      <Button type="submit" fullWidth loading={loading} loadingText="Checking…" className="h-11">
        Verify
      </Button>
      <p className="text-center text-xs text-subtle">
        Lost your phone? Contact support to reset two-step verification. Wrong account?{" "}
        <button type="submit" form="two-factor-sign-out" className="text-muted hover:text-accent">
          Sign out
        </button>
      </p>
    </form>
  );
}
