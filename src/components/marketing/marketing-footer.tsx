import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

const linkColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Use cases", href: "#use-cases" },
      { label: "How it works", href: "#how-it-works" },
      { label: "App preview", href: routes.dashboard },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: routes.signIn },
      { label: "Create account", href: routes.signUp },
      { label: "Reset password", href: routes.forgotPassword },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border pb-12 pt-16 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-border pb-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-4 sm:col-span-2">
            <Logo size="sm" />
            <p className="max-w-sm text-sm leading-relaxed text-muted">{siteConfig.description}</p>
          </div>

          {linkColumns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">
                {column.title}
              </h2>
              <ul className="space-y-2.5 text-muted">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-subtle sm:flex-row">
          <p>© 2026 {siteConfig.name}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-muted">
              Terms of Service
            </a>
            <a href="#" className="hover:text-muted">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
