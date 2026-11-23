import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Two-step verification" };

export default function TwoFactorPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: ShieldCheck, label: "Two-step verification" }}
      headline="One more check."
      description="Your account is protected with two-step verification. Open your authenticator app to get your code."
      footnote="Codes change every 30 seconds."
      mobileLink={{ href: routes.signIn, label: "Sign in" }}
    >
      <AuthHeading title="Enter your code" subtitle="Type the 6-digit code from your authenticator app." />
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
      <form id="two-factor-sign-out" action={routes.signOut} method="post" />
    </AuthSplitLayout>
  );
}
