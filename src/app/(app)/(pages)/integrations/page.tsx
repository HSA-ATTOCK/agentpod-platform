import type { Metadata } from "next";
import { Suspense } from "react";
import { NativeIntegrations, type NativeService } from "@/components/integrations/native-integrations";
import { IntegrationsView, type ApiKeyRow, type GoogleAccountRow } from "@/components/pages/integrations-view";
import { listOAuthAccounts, oauthAppId, oauthRedirectUri, PROVIDERS, type OAuthProvider } from "@/lib/integrations/oauth-apps";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { canManage, requireAppContext } from "@/lib/data/context";
import { googleClientFor, isGoogleConfigured, workspaceGoogleAppId } from "@/lib/integrations/google/oauth";
import { serverOrigin } from "@/lib/origin";
import { isAdminConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Integrations" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.slice(0, 300) : undefined;
}

async function PageContent({ searchParams }: PageProps<"/integrations">) {
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  // Members can see what's connected (never the secrets: those are in a server-only table)
  const { data: rows } = await ctx.supabase
    .from("integrations")
    .select("id, provider, status, account_email, label, is_default, config, connected_by, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: true });

  const people = [...new Set((rows ?? []).map((r) => r.connected_by).filter(Boolean))] as string[];
  const { data: profiles } = people.length
    ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", people)
    : { data: [] };
  const nameOf = (id: string | null) => {
    const p = profiles?.find((x) => x.id === id);
    return p ? p.full_name || p.email : null;
  };

  const googleAccounts: GoogleAccountRow[] = (rows ?? [])
    .filter((r) => r.provider === "google")
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    .map((r) => ({
      id: r.id,
      email: r.account_email ?? r.label,
      isDefault: r.is_default,
      status: r.status,
      connectedBy: nameOf(r.connected_by),
      createdAt: r.created_at,
    }));
  const apiKeys: ApiKeyRow[] = (rows ?? [])
    .filter((r) => r.provider === "api_key")
    .map((r) => ({
      id: r.id,
      name: r.label,
      host: (r.config as { host?: string } | null)?.host ?? "",
      connectedBy: nameOf(r.connected_by),
      createdAt: r.created_at,
    }));

  const admin = isAdminConfigured();
  const [ownAppId, client] = admin
    ? await Promise.all([workspaceGoogleAppId(ctx.workspace.id), googleClientFor(ctx.workspace.id)])
    : [null, null];

  const WHAT: Record<OAuthProvider, string> = {
    slack: "Read channels; post messages with your approval",
    hubspot: "Search contacts and deals; create or update with approval",
    microsoft: "Outlook mail and calendar; sending needs approval",
    quickbooks: "Read reports, invoices and customers (read-only)",
    xero: "Read reports, invoices and contacts (read-only)",
    shopify: "Read orders, products, customers and stock (read-only)",
  };
  const native: NativeService[] = admin
    ? await Promise.all(
        (Object.keys(PROVIDERS) as OAuthProvider[]).map(async (key) => ({
          key,
          name: PROVIDERS[key].name,
          what: WHAT[key],
          appClientId: await oauthAppId(ctx.workspace.id, key),
          accounts: await listOAuthAccounts(ctx.workspace.id, key),
          redirectUri: oauthRedirectUri(serverOrigin(), key),
          consoleUrl: PROVIDERS[key].setup.consoleUrl,
          steps: PROVIDERS[key].setup.steps,
        })),
      )
    : (Object.keys(PROVIDERS) as OAuthProvider[]).map((key) => ({
        key,
        name: PROVIDERS[key].name,
        what: WHAT[key],
        appClientId: null,
        accounts: [],
        redirectUri: oauthRedirectUri(serverOrigin(), key),
        consoleUrl: PROVIDERS[key].setup.consoleUrl,
        steps: PROVIDERS[key].setup.steps,
      }));

  return (
    <div className="space-y-10">
    <IntegrationsView
      googleAccounts={googleAccounts}
      apiKeys={apiKeys}
      googleConfigured={Boolean(client)}
      googleApp={{ clientId: ownAppId, platformAvailable: isGoogleConfigured(), redirectUri: `${serverOrigin()}/api/integrations/google/callback` }}
      keysAvailable={isAdminConfigured()}
      canManage={canManage(ctx.workspace.role)}
      flash={{ connected: one(params.connected), account: one(params.account), error: one(params.error) }}
    />
    <NativeIntegrations services={native} canManage={canManage(ctx.workspace.role)} available={admin} />
    </div>
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
