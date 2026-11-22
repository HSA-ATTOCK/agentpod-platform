import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Set a new password" };

/** Opened from the password-reset email (the proxy makes sure the link signed you in). */
export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: KeyRound, label: "Account recovery" }}
      headline="Choose a new password."
      description="Pick a strong password you don't use anywhere else. You'll stay signed in on this device."
      footnote="Other devices keep working until their session expires."
      mobileLink={{ href: routes.signIn, label: "Back to sign in" }}
    >
      <AuthHeading title="Set a new password" subtitle="Enter your new password twice to confirm it." />
      <ResetPasswordForm />
    </AuthSplitLayout>
  );
}
