import { Check, Zap } from "lucide-react";
import type { Metadata } from "next";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Sign up" };

const highlights = [
  "Agents for sales, support, operations, marketing and research",
  "Human approval before sensitive actions",
  "A private workspace for your business and team",
];

export default function SignUpPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: Zap, label: "Get started" }}
      headline="Start building your company's AI workforce."
      description="Create agents for lead research, support triage, document processing and operations, with a full history of everything they do."
      extras={
        <ul className="space-y-2.5 pt-4 text-xs text-muted">
          {highlights.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      }
      footnote="Built for small and medium-sized businesses."
      mobileLink={{ href: routes.home, label: "Back to home" }}
    >
      <AuthHeading
        title="Create your account"
        subtitle="Set up your AgentPod workspace in a few minutes."
      />
      <SignUpForm />
      <AuthFooterLink text="Already have an account?" href={routes.signIn} linkLabel="Sign in" />
    </AuthSplitLayout>
  );
}
