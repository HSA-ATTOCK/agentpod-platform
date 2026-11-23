import type { Metadata } from "next";
import { AskBaba } from "@/components/ask/ask-baba";
import { requireAppContext } from "@/lib/data/context";
import { listConversations } from "@/lib/data/conversations";

export const metadata: Metadata = { title: "Ask Baba" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function AskBabaPage({ searchParams }: PageProps<"/ask">) {
  const [ctx, params] = await Promise.all([requireAppContext(), searchParams]);
  const conversations = await listConversations(ctx);

  return (
    // Fills the screen between the top bar and (on phones) the bottom tab bar
    <main className="flex h-[calc(100dvh-7rem-1px-env(safe-area-inset-bottom))] min-h-0 lg:h-[calc(100dvh-4rem)]">
      <AskBaba
        initialConversations={conversations}
        workspaceId={ctx.workspace.id}
        userId={ctx.user.id}
        canWrite={ctx.workspace.role !== "viewer"}
        initialActiveId={one(params.c)}
        initialPrompt={one(params.prompt)?.slice(0, 20000)}
        workflowId={one(params.workflow)}
      />
    </main>
  );
}
