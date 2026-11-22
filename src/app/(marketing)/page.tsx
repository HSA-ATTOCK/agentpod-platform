import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

// Placeholder — replaced by the Phase 1 landing page.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{siteConfig.name}</h1>
      <p className="max-w-md text-muted">{siteConfig.description}</p>
      <div className="flex gap-3">
        <Link
          href={routes.signUp}
          className="rounded-control bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Get started
        </Link>
        <Link
          href={routes.dashboard}
          className="rounded-control border border-border px-4 py-2 font-medium hover:bg-surface-hover"
        >
          View dashboard
        </Link>
      </div>
    </main>
  );
}
