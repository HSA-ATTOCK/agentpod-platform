import type { Metadata } from "next";
import { WorkflowsView } from "@/components/pages/workflows-view";

export const metadata: Metadata = { title: "Workflows" };

export default function Page() {
  return <WorkflowsView />;
}
