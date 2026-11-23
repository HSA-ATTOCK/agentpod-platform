import type { Metadata } from "next";
import { ProjectsView } from "@/components/pages/projects-view";
import { requireAppContext } from "@/lib/data/context";
import { listFiles } from "@/lib/data/pages";

export const metadata: Metadata = { title: "Projects" };

export default async function Page() {
  const ctx = await requireAppContext();
  const files = await listFiles(ctx);
  return <ProjectsView files={files} />;
}
