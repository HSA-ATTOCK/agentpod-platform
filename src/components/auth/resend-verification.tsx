"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resendVerificationEmail, type AuthResult } from "@/lib/auth/placeholder";

/** "Resend verification email" box with loading and result messages. */
export function ResendVerification() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    setResult(await resendVerificationEmail());
    setLoading(false);
  }

  return (
    <div className="mb-6 space-y-4 text-left">
      {result?.ok && (
        <Alert variant="success">
          A new verification link is on its way. Check your spam folder if it doesn&apos;t arrive
          within a few minutes.
        </Alert>
      )}
      {result && !result.ok && <Alert variant="error">{result.error}</Alert>}

      <div className="space-y-3 rounded-xl border border-border bg-surface-raised p-4">
        <p className="text-xs text-subtle">
          Didn&apos;t receive the email? Check your junk folder or request a new one.
        </p>
        <Button variant="secondary" fullWidth loading={loading} loadingText="Sending…" onClick={handleClick}>
          Resend verification email
        </Button>
      </div>
    </div>
  );
}
