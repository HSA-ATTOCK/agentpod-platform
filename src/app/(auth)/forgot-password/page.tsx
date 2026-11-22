import { ArrowLeft, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: KeyRound, label: "Account recovery" }}
      headline="Get back into your workspace."
      description="Enter the email you signed up with and we'll send you a secure, single-use link to reset your password."
      footnote="Reset links expire after a short time for your security."
      mobileLink={{ href: routes.signIn, label: "Back to sign in" }}
    >
      <AuthHeading
        title="Forgot password?"
        subtitle="No worries, we'll send reset instructions to your email."
      />
      <ForgotPasswordForm />
      <AuthFooterLink
        text="Remember your password?"
        href={routes.signIn}
        linkLabel="Back to sign in"
        icon={<ArrowLeft aria-hidden="true" className="size-3" />}
      />
    </AuthSplitLayout>
  );
}
