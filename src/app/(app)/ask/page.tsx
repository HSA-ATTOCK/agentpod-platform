import type { Metadata } from "next";
import { AskBaba } from "@/components/ask/ask-baba";

export const metadata: Metadata = { title: "Ask Baba" };

export default function AskBabaPage() {
  return (
    // Fills the screen between the top bar and (on phones) the bottom tab bar
    <main className="flex h-[calc(100dvh-7rem-1px-env(safe-area-inset-bottom))] min-h-0 lg:h-[calc(100dvh-4rem)]">
      <AskBaba />
    </main>
  );
}
