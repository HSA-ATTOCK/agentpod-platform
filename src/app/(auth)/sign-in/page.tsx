import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { SignInForm } from "@/components/auth/sign-in-form";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: ShieldCheck, label: "Your private workspace" }}
      headline="AI automation with complete human oversight."
      description="Sign in to manage your agents, review the work they produce and approve sensitive actions before they happen."
      footnote="Every business gets its own isolated workspace."
      mobileLink={{ href: routes.home, label: "Back to home" }}
    >
      <AuthHeading
        title="Sign in to your account"
        subtitle="Welcome back. Enter your details below."
      />
      <SignInForm />
      <AuthFooterLink text="Don't have an account?" href={routes.signUp} linkLabel="Sign up" />
    </AuthSplitLayout>
  );
}
