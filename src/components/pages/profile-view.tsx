"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { isValidEmail, meetsPasswordRules } from "@/lib/validation";

const SAVED = "Saved (sample — not connected yet).";

export function ProfileView() {
  const [name, setName] = useState("Sarah Connor");
  const [email, setEmail] = useState("sarah@acme.com");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast, showToast } = useToast();

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Enter your name.",
      email: isValidEmail(email) ? undefined : "Enter a valid email address.",
    };
    setErrors(next);
    if (!next.name && !next.email) showToast(SAVED);
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const next = {
      current: pw.current ? undefined : "Enter your current password.",
      next: meetsPasswordRules(pw.next) ? undefined : "Password must meet all the requirements.",
      confirm: pw.confirm === pw.next && pw.confirm ? undefined : "Passwords don't match.",
    };
    setPwErrors(next);
    if (!next.current && !next.next && !next.confirm) {
      setPw({ current: "", next: "", confirm: "" });
      showToast(SAVED);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Profile" description="Your personal details, password and usage." sample />

      <Card className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={name || "?"} className="size-16 border-2 border-accent text-xl text-accent" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{name || "Your name"}</h2>
              <Badge tone="accent">Owner</Badge>
            </div>
            <p className="text-sm text-muted">{email}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => showToast("Photo upload isn't available yet.")}>Change photo</Button>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Personal details</h2>
        <form noValidate onSubmit={saveProfile} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="p-name" label="Full name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
            <Input
              id="p-email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              hint="Changing your email needs verification."
            />
            <Input id="p-title" label="Job title" defaultValue="Operations Manager" autoComplete="organization-title" />
            <Input id="p-phone" type="tel" label="Phone (optional)" autoComplete="tel" placeholder="+44 7700 900123" />
            <div>
              <label htmlFor="p-lang" className="mb-1.5 block text-xs font-semibold text-muted">Language</label>
              <select id="p-lang" defaultValue="en-GB" className={selectClasses}>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="ur">اردو (Urdu)</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-tz" className="mb-1.5 block text-xs font-semibold text-muted">Timezone</label>
              <select id="p-tz" defaultValue="Europe/London" className={selectClasses}>
                <option value="Europe/London">London</option>
                <option value="Asia/Karachi">Karachi</option>
                <option value="Asia/Dubai">Dubai</option>
                <option value="America/New_York">New York</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Password</h2>
        <form noValidate onSubmit={savePassword} className="mt-5 max-w-lg space-y-4">
          <PasswordInput id="pw-current" label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErrors.current} />
          <PasswordInput
            id="pw-new"
            label="New password"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            error={pwErrors.next}
            hint={<PasswordChecklist password={pw.next} />}
          />
          <PasswordInput id="pw-confirm" label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErrors.confirm} />
          <Button type="submit" variant="secondary">Update password</Button>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Your usage this month</h2>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Tasks you ran</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground">31</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Your spend</dt>
            <dd className="mt-1 text-2xl font-bold text-accent">$4.18</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Most used specialist</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Search aria-hidden="true" className="size-4 text-accent" /> Research Analyst
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Button variant="secondary" onClick={() => showToast("Session management isn't connected yet.")}>Sign out of all devices</Button>
        <button type="button" onClick={() => setDeleteOpen(true)} className="self-start py-2 text-sm font-semibold text-danger hover:underline sm:self-auto">
          Delete my account
        </button>
      </Card>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} side="center" title="Delete your account">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            You&apos;re the owner of <strong className="text-foreground">Acme Corp</strong>. Transfer ownership to another admin before deleting your account.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(false);
                showToast("Sample account — nothing was deleted.");
              }}
            >
              Delete account
            </Button>
          </div>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
