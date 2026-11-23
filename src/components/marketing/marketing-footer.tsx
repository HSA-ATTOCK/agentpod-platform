import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

const linkColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: routes.features },
      { label: "AI Agents", href: routes.aiAgents },
      { label: "Integrations", href: routes.connections },
      { label: "Use cases", href: routes.useCases },
      { label: "Pricing", href: routes.pricing },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: routes.about },
      { label: "Contact", href: routes.contact },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: routes.signIn },
      { label: "Request access", href: routes.signUp },
      { label: "Reset password", href: routes.forgotPassword },
      { label: "Open the app", href: routes.ask },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border pb-12 pt-16 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-border pb-12 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-4 sm:col-span-3 lg:col-span-2">
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
            <Link href={routes.terms} className="hover:text-muted">
              Terms of Service
            </Link>
            <Link href={routes.privacy} className="hover:text-muted">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
