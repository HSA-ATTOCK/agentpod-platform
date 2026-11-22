import type { ReactNode } from "react";

/** Centers the auth card on the page. Each page renders its own AuthSplitLayout. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-4">{children}</main>
  );
}
