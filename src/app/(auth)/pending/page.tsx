import { Clock, ShieldAlert, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { routes } from "@/config/routes";
import { getAccount, getPlatformSettings } from "@/lib/platform/account";
import { notifyAdminsOfRegistration } from "@/lib/platform/registrations";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account status" };

const COPY = {
  pending_approval: {
    title: "Your account is waiting for approval",
    text: "Thanks for signing up. Every new Baba account is reviewed by our team before it can be used. You'll get an email as soon as yours is approved — usually within one working day.",
  },
  rejected: {
    title: "Your registration wasn't approved",
    text: "We weren't able to approve this account. If you think this is a mistake, please contact us.",
  },
  suspended: {
    title: "Your account is suspended",
    text: "This account has been suspended, so the workspace isn't available. Please contact us if you have questions.",
  },
  deactivated: {
    title: "Your account is deactivated",
    text: "This account is no longer active. Contact us if you'd like it reactivated.",
  },
} as const;

async function Status() {
  await connection();
  const supabase = await getSupabaseServer();
  const account = await getAccount(supabase);
  if (!account) redirect(routes.signIn);

  if (account.status === "approved") {
    // Approved: the only reason to be here is maintenance mode
    const settings = await getPlatformSettings(supabase);
    if (!settings?.maintenanceMode || account.isAdmin) redirect(routes.ask);
    return (
      <StatusCard icon={Wrench} title="Down for maintenance" text={settings.maintenanceMessage} email={account.email} />
    );
  }

  if (account.status === "pending_approval") await notifyAdminsOfRegistration(account.userId);
  const copy = COPY[account.status];
  return (
    <StatusCard
      icon={account.status === "pending_approval" ? Clock : ShieldAlert}
      title={copy.title}
      text={copy.text}
      reason={account.status === "pending_approval" ? null : account.reason}
      email={account.email}
    />
  );
}

function StatusCard({
  icon: Icon,
  title,
  text,
  reason,
  email,
}: {
  icon: typeof Clock;
  title: string;
  text: string;
  reason?: string | null;
  email: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent sm:mx-0">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <p className="mb-4 text-sm leading-relaxed text-muted">{text}</p>
      {reason && <p className="mb-4 rounded-control border border-border bg-surface-raised p-3 text-sm text-foreground">{reason}</p>}
      <p className="mb-6 text-xs text-subtle">Signed in as {email}</p>
      <div className="flex flex-wrap justify-center gap-2 border-t border-border pt-4 sm:justify-start">
        <ButtonLink href={routes.pending} variant="secondary">
          Check again
        </ButtonLink>
        <form action={routes.signOut} method="post">
          <button type="submit" className="h-10 rounded-control px-4 text-sm text-muted transition-colors hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <AuthSplitLayout
      badge={{ icon: Clock, label: "Account review" }}
      headline="Almost there."
      description="Baba does real work with real business data, so every account is approved by a person before it can be used."
      footnote="You can close this page; we'll email you."
      mobileLink={{ href: routes.signIn, label: "Sign in" }}
    >
      <Suspense fallback={<Spinner />}>
        <Status />
      </Suspense>
    </AuthSplitLayout>
  );
}
