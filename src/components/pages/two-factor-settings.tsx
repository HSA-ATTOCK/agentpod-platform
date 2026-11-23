"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Enrolling = { factorId: string; qr: string; secret: string };

/** Turn two-step verification (authenticator app) on or off for your own account. */
export function TwoFactorSettings() {
  const supabase = getSupabaseBrowser();
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined); // undefined = loading
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!cancelled) setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function start() {
    setBusy(true);
    setError(null);
    setMessage(null);
    // Clear out any half-finished setup first
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Couldn't start the setup. Please try again.");
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!enrolling) return;
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Enter the 6-digit code shown in your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: clean });
    setBusy(false);
    if (verifyError) {
      setError("That code isn't right. Check the time on your phone and try the newest code.");
      return;
    }
    setFactorId(enrolling.factorId);
    setEnrolling(null);
    setCode("");
    setMessage("Two-step verification is on. You'll need a code from your app each time you sign in.");
  }

  async function turnOff() {
    if (!factorId) return;
    if (!window.confirm("Turn off two-step verification? Your account will only be protected by your password.")) return;
    setBusy(true);
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    // Refresh the session so it no longer claims a second step
    await supabase.auth.refreshSession();
    setFactorId(null);
    setMessage("Two-step verification is off.");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3 text-sm text-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 text-accent" /> Two-step verification
        </span>
        {factorId === undefined ? null : factorId ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
      </div>
      <p className="text-xs text-muted">
        After your password, Baba asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft
        Authenticator, 1Password…). Someone who steals your password still can&apos;t get in.
      </p>
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {enrolling ? (
        <form noValidate onSubmit={confirm} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Open your authenticator app and add a new account.</li>
            <li>Scan this QR code (or type the key below).</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* Supabase returns the QR code as an SVG data URL */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolling.qr} alt="QR code for your authenticator app" className="size-40 rounded-lg bg-white p-2" />
            <div className="min-w-0 text-xs text-muted">
              <p>Can&apos;t scan? Enter this key:</p>
              <code className="mt-1 block break-all rounded bg-surface px-2 py-1.5 font-mono text-foreground">{enrolling.secret}</code>
            </div>
          </div>
          <Input
            id="mfa-code"
            label="Code from the app"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="max-w-48"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={busy} loadingText="Checking…">Turn on</Button>
            <Button
              variant="secondary"
              onClick={() => {
                void supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
                setEnrolling(null);
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : factorId ? (
        <Button variant="secondary" onClick={turnOff} loading={busy} loadingText="Turning off…">Turn off</Button>
      ) : factorId === null ? (
        <Button onClick={start} loading={busy} loadingText="Starting…">Set up two-step verification</Button>
      ) : null}
    </div>
  );
}
