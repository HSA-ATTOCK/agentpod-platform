import type { Metadata } from "next";
import { AgentsView } from "@/components/pages/agents-view";

export const metadata: Metadata = { title: "AI Agents" };

export default function Page() {
  return <AgentsView />;
}
