import type { Metadata } from "next";
import { Suspense } from "react";
import { IntegrationsView, type GoogleConnection } from "@/components/pages/integrations-view";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { canManage, requireAppContext } from "@/lib/data/context";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import { isAdminConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Integrations" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.slice(0, 300) : undefined;
}

async function PageContent({ searchParams }: PageProps<"/integrations">) {
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const { data: row } = await ctx.supabase
    .from("integrations")
    .select("status, account_email, connected_by")
    .eq("workspace_id", ctx.workspace.id)
    .eq("provider", "google")
    .maybeSingle();

  let google: GoogleConnection = null;
  if (row && (row.status === "connected" || row.status === "error")) {
    const { data: who } = row.connected_by
      ? await ctx.supabase.from("profiles").select("full_name, email").eq("id", row.connected_by).maybeSingle()
      : { data: null };
    google = { status: row.status, accountEmail: row.account_email, connectedBy: who?.full_name || who?.email || null };
  }

  return (
    <IntegrationsView
      google={google}
      googleConfigured={isGoogleConfigured() && isAdminConfigured()}
      canManage={canManage(ctx.workspace.role)}
      flash={{ connected: one(params.connected), account: one(params.account), error: one(params.error) }}
    />
  );
}

/** Shows a placeholder straight away while this page's data loads. */
export default function Page(props: PageProps<"/integrations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent {...props} />
    </Suspense>
  );
}
