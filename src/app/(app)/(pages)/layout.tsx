import type { ReactNode } from "react";

/** Standard padded content area used by most app pages. */
export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    // Bottom padding keeps content clear of the mobile tab bar
    <main className="w-full max-w-7xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8 lg:pb-12">
      {children}
    </main>
  );
}
