import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ResendVerification } from "@/components/auth/resend-verification";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: MailCheck, label: "Email verification" }}
      headline="One last step."
      description="Verifying your email keeps your workspace secure and makes sure important notifications, like approval requests, reach you."
      footnote="You can close this page after verifying."
      mobileLink={{ href: routes.signIn, label: "Sign in" }}
    >
      <div className="text-center sm:text-left">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent sm:mx-0">
          <Mail aria-hidden="true" className="size-7" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Check your inbox
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          We sent a verification link to your email address. Click the link to activate your
          account and open your Baba workspace.
        </p>

        <Suspense fallback={null}>
          <ResendVerification />
        </Suspense>

        <div className="border-t border-border pt-4 text-xs">
          <Link
            href={routes.signIn}
            className="inline-flex items-center gap-1.5 py-2 text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
