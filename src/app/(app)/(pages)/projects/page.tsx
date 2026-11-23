import type { Metadata } from "next";
import { ProjectsView } from "@/components/pages/projects-view";
import { requireAppContext } from "@/lib/data/context";
import { listFiles } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Projects" };

async function PageContent() {
  const ctx = await requireAppContext();
  const files = await listFiles(ctx);
  return <ProjectsView files={files} />;
}

/** Shows a placeholder straight away while this page's data loads. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
