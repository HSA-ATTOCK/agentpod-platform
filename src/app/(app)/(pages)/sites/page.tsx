import type { Metadata } from "next";
import { Suspense } from "react";
import { SitesView, type SiteRow } from "@/components/pages/sites-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { canManage, requireAppContext } from "@/lib/data/context";
import { isProductionConfigured } from "@/lib/sites/production";
import { previewUrl } from "@/lib/sites/sites";

export const metadata: Metadata = { title: "Websites" };

async function PageContent() {
  const ctx = await requireAppContext();
  const now = new Date().toISOString();
  const { data } = await ctx.supabase
    .from("sites")
    .select("id, name, slug, status, current_version, expires_at, conversation_id, production_url, production_version, published_at, custom_domain, site_versions (version, note, created_at, file_count)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });
  const { data: submissions } = await ctx.supabase
    .from("site_form_submissions")
    .select("id, site_id, form_name, data, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const sites: SiteRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    url: previewUrl(s.slug),
    status: s.status,
    currentVersion: s.current_version,
    expiresAt: s.expires_at,
    expired: s.expires_at < now,
    conversationId: s.conversation_id,
    productionUrl: s.production_url,
    productionVersion: s.production_version,
    customDomain: s.custom_domain,
    submissions: (submissions ?? [])
      .filter((f) => f.site_id === s.id)
      .map((f) => ({ id: f.id, form: f.form_name, data: f.data as Record<string, string>, createdAt: f.created_at })),
    versions: (s.site_versions ?? [])
      .map((v) => ({ version: v.version, note: v.note, createdAt: v.created_at, fileCount: v.file_count }))
      .sort((a, b) => b.version - a.version),
  }));
  return <SitesView sites={sites} canManage={canManage(ctx.workspace.role)} productionAvailable={isProductionConfigured()} />;
}

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Websites" description="Sites Baba built for you, with live preview links and every version kept so you can roll back." />
      <Suspense fallback={<PageSkeleton />}>
        <PageContent />
      </Suspense>
    </div>
  );
}
