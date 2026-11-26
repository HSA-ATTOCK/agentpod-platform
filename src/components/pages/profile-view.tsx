"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input, selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/config/routes";
import { formatCents } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isValidEmail, meetsPasswordRules } from "@/lib/validation";
import type { ProfileRecord } from "@/types/app-data";

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" } as const;

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

export type ProfileUsage = { tasks: number; costCents: number; topSpecialist: string | null };

type ProfileViewProps = {
  profile: ProfileRecord;
  role: keyof typeof ROLE_LABEL;
  usage: ProfileUsage;
  /** False for accounts that sign in only with Google. */
  hasPassword: boolean;
};

export function ProfileView({ profile, role, usage, hasPassword }: ProfileViewProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const { toast, showToast } = useToast();

  const [details, setDetails] = useState({
    name: profile.fullName,
    jobTitle: profile.jobTitle ?? "",
    phone: profile.phone ?? "",
    language: profile.language,
    timezone: profile.timezone,
  });
  const [email, setEmail] = useState(profile.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [pwSaving, setPwSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const next = {
      name: details.name.trim() ? undefined : "Enter your name.",
      email: isValidEmail(email) ? undefined : "Enter a valid email address.",
    };
    setErrors(next);
    if (next.name || next.email) return;

    setSaving(true);
    setFormError(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: details.name.trim().slice(0, 120),
        job_title: details.jobTitle.trim() || null,
        phone: details.phone.trim() || null,
        language: details.language,
        timezone: details.timezone,
      })
      .eq("id", profile.id);
    if (error) {
      setSaving(false);
      setFormError("Couldn't save your details. Please try again.");
      return;
    }

    let message = "Profile saved.";
    if (email.trim().toLowerCase() !== profile.email.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: `${window.location.origin}${routes.authCallback}?next=${routes.profile}` },
      );
      if (emailError) {
        setSaving(false);
        setFormError(`Your details were saved, but the email change failed: ${emailError.message}`);
        return;
      }
      message = "Profile saved. Check both inboxes to confirm your new email address.";
    }
    setSaving(false);
    showToast(message);
    router.refresh();
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    const next = {
      current: pw.current ? undefined : "Enter your current password.",
      next: meetsPasswordRules(pw.next) ? undefined : "Password must meet all the requirements.",
      confirm: pw.confirm === pw.next && pw.confirm ? undefined : "Passwords don't match.",
    };
    setPwErrors(next);
    if (next.current || next.next || next.confirm) return;

    setPwSaving(true);
    // Check the current password first
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: profile.email, password: pw.current });
    if (checkError) {
      setPwSaving(false);
      setPwErrors({ current: "That isn't your current password." });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwSaving(false);
    if (error) {
      setPwErrors({ next: error.message });
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    showToast("Password updated.");
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    window.location.assign(routes.signIn);
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      setDeleteError(
        /transfer ownership/i.test(error.message)
          ? `${error.message.replace(/^.*?(transfer)/i, "Transfer")}. Do it in Settings → Team.`
          : "Couldn't delete your account. Please try again.",
      );
      return;
    }
    await supabase.auth.signOut();
    window.location.assign(routes.home);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Profile" description="Your personal details, password and usage." />

      <Card className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={details.name || "?"} src={profile.avatarUrl} className="size-16 border-2 border-accent text-xl text-accent" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{details.name || "Your name"}</h2>
              <Badge tone="accent">{ROLE_LABEL[role]}</Badge>
            </div>
            <p className="text-sm text-muted">{profile.email}</p>
            <p className="mt-0.5 text-xs text-subtle">
              Member since <LocalTime iso={profile.createdAt} format="date" />
            </p>
            <div className="mt-2">
              <ImageUpload
                bucket="avatars"
                folder={profile.id}
                hasImage={Boolean(profile.avatarUrl)}
                label="Upload profile photo"
                onError={showToast}
                onChange={async (url) => {
                  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
                  showToast(error ? "Couldn't save your photo." : url ? "Photo updated." : "Photo removed.");
                  if (!error) router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Personal details</h2>
        <form noValidate onSubmit={saveProfile} className="mt-5 space-y-5">
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="p-name"
              label="Full name"
              required
              autoComplete="name"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              error={errors.name}
            />
            <Input
              id="p-email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              hint="Changing your email sends a confirmation link."
            />
            <Input
              id="p-title"
              label="Job title"
              autoComplete="organization-title"
              value={details.jobTitle}
              onChange={(e) => setDetails({ ...details, jobTitle: e.target.value })}
            />
            <Input
              id="p-phone"
              type="tel"
              label="Phone (optional)"
              autoComplete="tel"
              placeholder="+44 7700 900123"
              value={details.phone}
              onChange={(e) => setDetails({ ...details, phone: e.target.value })}
            />
            <div>
              <label htmlFor="p-lang" className="mb-1.5 block text-xs font-semibold text-muted">Language</label>
              <select id="p-lang" value={details.language} onChange={(e) => setDetails({ ...details, language: e.target.value })} className={selectClasses}>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="ur">اردو (Urdu)</option>
                <option value="ar">العربية (Arabic)</option>
              </select>
            </div>
            <div>
              <label htmlFor="p-tz" className="mb-1.5 block text-xs font-semibold text-muted">Timezone</label>
              <select id="p-tz" value={details.timezone} onChange={(e) => setDetails({ ...details, timezone: e.target.value })} className={selectClasses}>
                {(TIMEZONES.includes(details.timezone) ? TIMEZONES : [details.timezone, ...TIMEZONES]).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} loadingText="Saving…">Save profile</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Password</h2>
        {!hasPassword ? (
          <p className="mt-3 max-w-lg text-sm text-muted">
            You sign in with Google, so this account has no password to change. Your sign-in is protected by your Google account.
          </p>
        ) : (
          <form noValidate onSubmit={savePassword} className="mt-5 max-w-lg space-y-4">
          <PasswordInput
            id="pw-current"
            label="Current password"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            error={pwErrors.current}
          />
          <PasswordInput
            id="pw-new"
            label="New password"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            error={pwErrors.next}
            hint={<PasswordChecklist password={pw.next} />}
          />
          <PasswordInput
            id="pw-confirm"
            label="Confirm new password"
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            error={pwErrors.confirm}
          />
          <Button type="submit" variant="secondary" loading={pwSaving} loadingText="Updating…">
            Update password
          </Button>
          </form>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Your usage this month</h2>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Tasks you ran</dt>
            <dd className="mt-1 text-2xl font-bold text-foreground">{usage.tasks}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Your spend</dt>
            <dd className="mt-1 text-2xl font-bold text-accent">{formatCents(usage.costCents)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="text-xs text-subtle">Most used specialist</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-base font-semibold text-foreground">
              {usage.topSpecialist ? (
                <>
                  <Search aria-hidden="true" className="size-4 text-accent" /> {usage.topSpecialist}
                </>
              ) : (
                <span className="text-sm font-normal text-subtle">None yet</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={signOutEverywhere}>Sign out of all devices</Button>
          {/* A plain link: the browser downloads the JSON file */}
          <a href="/api/account/export" className="inline-flex h-10 items-center rounded-control border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised">
            Download my data
          </a>
        </div>
        <button
          type="button"
          onClick={() => {
            setDeleteConfirm("");
            setDeleteError(null);
            setDeleteOpen(true);
          }}
          className="self-start py-2 text-sm font-semibold text-danger hover:underline sm:self-auto"
        >
          Delete my account
        </button>
      </Card>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} side="center" title="Delete your account">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted">
            This permanently deletes your account and any workspace only you use, with its conversations, files and
            history. If you own a workspace other people use, transfer ownership first (Settings → Team).
          </p>
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <Input
            id="delete-account-confirm"
            label='Type "DELETE" to confirm'
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={deleteConfirm !== "DELETE"} loading={deleting} loadingText="Deleting…" onClick={deleteAccount}>
              Delete account
            </Button>
          </div>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
