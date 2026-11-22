"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUpWithPassword, type AuthResult } from "@/lib/auth/placeholder";
import { isValidEmail, meetsPasswordRules } from "@/lib/validation";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";
import { PasswordChecklist } from "./password-checklist";

type Fields = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

// Order used to focus the first invalid field
const FIELD_ORDER: (keyof Fields)[] = ["fullName", "email", "password", "confirmPassword", "terms"];

function validate(f: Fields): Errors {
  const errors: Errors = {};
  if (!f.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!f.email.trim()) errors.email = "Enter your work email.";
  else if (!isValidEmail(f.email)) errors.email = "Enter a valid email address.";
  if (!meetsPasswordRules(f.password)) errors.password = "Password must meet all the requirements.";
  if (!f.confirmPassword) errors.confirmPassword = "Confirm your password.";
  else if (f.confirmPassword !== f.password) errors.confirmPassword = "Passwords don't match.";
  if (!f.terms) errors.terms = "You must accept the terms to create an account.";
  return errors;
}

export function SignUpForm() {
  const [fields, setFields] = useState<Fields>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleBlur(key: keyof Fields) {
    const fieldErrors = validate(fields);
    setErrors((prev) => ({ ...prev, [key]: fieldErrors[key] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const nextErrors = validate(fields);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setLoading(true);
    setResult(await signUpWithPassword(fields.fullName, fields.email, fields.password));
    setLoading(false);
  }

  return (
    <>
      <GoogleButton onResult={setResult} />
      <AuthDivider label="or sign up with work email" />

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {result && !result.ok && <Alert variant="info">{result.error}</Alert>}

        <Input
          id="fullName"
          label="Full name"
          placeholder="Sarah Connor"
          autoComplete="name"
          required
          value={fields.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          onBlur={() => handleBlur("fullName")}
          error={errors.fullName}
        />

        <Input
          id="email"
          type="email"
          label="Work email"
          placeholder="sarah@acme.com"
          autoComplete="email"
          required
          value={fields.email}
          onChange={(e) => update("email", e.target.value)}
          onBlur={() => handleBlur("email")}
          error={errors.email}
        />

        <PasswordInput
          id="password"
          label="Password"
          placeholder="Create a password"
          autoComplete="new-password"
          required
          value={fields.password}
          onChange={(e) => update("password", e.target.value)}
          onBlur={() => handleBlur("password")}
          error={errors.password}
          hint={<PasswordChecklist password={fields.password} />}
        />

        <PasswordInput
          id="confirmPassword"
          label="Confirm password"
          placeholder="Confirm your password"
          autoComplete="new-password"
          required
          value={fields.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          onBlur={() => handleBlur("confirmPassword")}
          error={errors.confirmPassword}
        />

        <div className="pt-1">
          <label htmlFor="terms" className="flex cursor-pointer select-none items-start gap-2.5">
            <input
              id="terms"
              type="checkbox"
              checked={fields.terms}
              onChange={(e) => update("terms", e.target.checked)}
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5 size-4 shrink-0 rounded accent-accent"
            />
            <span className="text-xs leading-relaxed text-muted">
              I agree to the{" "}
              <a href="#" className="text-foreground hover:underline">
                Terms of Service
              </a>{" "}
              and the{" "}
              <a href="#" className="text-foreground hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          <FieldError id="terms-error" message={errors.terms} />
        </div>

        <Button type="submit" fullWidth loading={loading} loadingText="Creating account…" className="mt-3 h-11">
          Create account
        </Button>
      </form>
    </>
  );
}
