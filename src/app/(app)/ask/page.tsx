import type { Metadata } from "next";
import { AskBaba } from "@/components/ask/ask-baba";
import { requireAppContext } from "@/lib/data/context";
import { listConversations } from "@/lib/data/conversations";

export const metadata: Metadata = { title: "Ask Baba" };

export default async function AskBabaPage() {
  const ctx = await requireAppContext();
  const conversations = await listConversations(ctx);

  return (
    // Fills the screen between the top bar and (on phones) the bottom tab bar
    <main className="flex h-[calc(100dvh-7rem-1px-env(safe-area-inset-bottom))] min-h-0 lg:h-[calc(100dvh-4rem)]">
      <AskBaba
        initialConversations={conversations}
        workspaceId={ctx.workspace.id}
        userId={ctx.user.id}
        canWrite={ctx.workspace.role !== "viewer"}
      />
    </main>
  );
}
