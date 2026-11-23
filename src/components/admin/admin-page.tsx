import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Title + a placeholder while the page's data loads. */
export function AdminPage({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </>
  );
}
