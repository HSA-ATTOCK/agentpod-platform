import type { Metadata } from "next";
import { connection } from "next/server";
import { ActivityView } from "@/components/pages/activity-view";
import { requireAppContext } from "@/lib/data/context";
import { listTasks, requestTime } from "@/lib/data/pages";

export const metadata: Metadata = { title: "Activity" };

export default async function Page({ searchParams }: PageProps<"/activity">) {
  await connection();
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const tasks = await listTasks(ctx);
  const agent = typeof params.agent === "string" ? params.agent : undefined;
  return <ActivityView tasks={tasks} now={requestTime()} initialAgent={agent} />;
}
