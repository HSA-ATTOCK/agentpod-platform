import type { Metadata } from "next";
import { Suspense } from "react";
import { MemoryView } from "@/components/pages/memory-view";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { requireAppContext } from "@/lib/data/context";
import { listDocuments, listMemory } from "@/lib/knowledge/knowledge";

export const metadata: Metadata = { title: "Memory" };

async function PageContent() {
  const ctx = await requireAppContext();
  const [memory, documents] = await Promise.all([listMemory(ctx), listDocuments(ctx)]);
  return <MemoryView memory={memory} documents={documents} canEdit={ctx.workspace.role !== "viewer"} />;
}

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Memory & knowledge" description="What Baba knows about your business. Shared with everyone in this workspace." />
      <Suspense fallback={<PageSkeleton />}>
        <PageContent />
      </Suspense>
    </div>
  );
}
