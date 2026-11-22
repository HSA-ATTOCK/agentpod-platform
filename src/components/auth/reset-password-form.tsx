"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { routes } from "@/config/routes";
import { updatePassword, type AuthResult } from "@/lib/auth/client";
import { meetsPasswordRules } from "@/lib/validation";
import { PasswordChecklist } from "./password-checklist";

type Errors = { password?: string; confirmPassword?: string };

/** Sets a new password. Reached from the reset link, which signs the person in first. */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  function validate(): Errors {
    const next: Errors = {};
    if (!meetsPasswordRules(password)) next.password = "Password must meet all the requirements.";
    if (!confirmPassword) next.confirmPassword = "Confirm your new password.";
    else if (confirmPassword !== password) next.confirmPassword = "Passwords don't match.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    const firstInvalid = (["password", "confirmPassword"] as const).find((f) => nextErrors[f]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setLoading(true);
    const response = await updatePassword(password);
    if (response.ok) {
      window.location.assign(routes.ask);
      return;
    }
    setResult(response);
    setLoading(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {result && !result.ok && <Alert variant="error">{result.error}</Alert>}

      <PasswordInput
        id="password"
        label="New password"
        placeholder="Create a new password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint={<PasswordChecklist password={password} />}
      />
      <PasswordInput
        id="confirmPassword"
        label="Confirm new password"
        placeholder="Confirm your new password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
      />

      <Button type="submit" fullWidth loading={loading} loadingText="Saving…" className="mt-2 h-11">
        Save new password
      </Button>
    </form>
  );
}
