import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

// Placeholder — replaced by the Phase 1 frontend.
export default function Page() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-muted">Sign-in page coming in Phase 1.</p>
    </main>
  );
}
