import type { Metadata } from "next";
import { connection } from "next/server";
import { ActivityView } from "@/components/pages/activity-view";
import { requireAppContext } from "@/lib/data/context";
import { listTasks, requestTime } from "@/lib/data/pages";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Activity" };

async function PageContent({ searchParams }: PageProps<"/activity">) {
  await connection();
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const tasks = await listTasks(ctx);
  const agent = typeof params.agent === "string" ? params.agent : undefined;
  return <ActivityView tasks={tasks} now={requestTime()} initialAgent={agent} />;
}

/** Shows a placeholder straight away while this page's data loads. */
export default function Page(props: PageProps<"/activity">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent {...props} />
    </Suspense>
  );
}
