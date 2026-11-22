import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify your email" };

// Placeholder — replaced by the Phase 1 frontend.
export default function Page() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="text-muted">Email verification page coming in Phase 1.</p>
    </main>
  );
}
