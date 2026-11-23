"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { routes } from "@/config/routes";
import { signInWithPassword, type AuthResult } from "@/lib/auth/client";
import { safeNext } from "@/lib/auth/safe-next";
import { isValidEmail } from "@/lib/validation";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";

type Errors = { email?: string; password?: string };

function validate(email: string, password: string): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  // Re-check a single field when the user leaves it
  function handleBlur(field: keyof Errors) {
    const fieldErrors = validate(email, password);
    setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    const firstInvalid = (["email", "password"] as const).find((f) => nextErrors[f]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setLoading(true);
    const response = await signInWithPassword(email, password);
    if (response.ok) {
      // Full page load so every server page sees the new session cookie
      window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
      return;
    }
    setResult(response);
    setLoading(false);
  }

  return (
    <>
      <GoogleButton onResult={setResult} />
      <AuthDivider label="or continue with email" />

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
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
          onBlur={() => handleBlur("email")}
          error={errors.email}
        />

        <PasswordInput
          id="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => handleBlur("password")}
          error={errors.password}
          labelAction={
            <Link
              href={routes.forgotPassword}
              className="text-xs text-muted transition-colors hover:text-accent"
            >
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" fullWidth loading={loading} loadingText="Signing in…" className="mt-2 h-11">
          Sign in
        </Button>
      </form>
    </>
  );
}
