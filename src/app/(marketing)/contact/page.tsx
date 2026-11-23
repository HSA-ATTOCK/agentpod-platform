import { Building2, Mail, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/page-hero";
import { legalConfig } from "@/config/legal";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Baba team about early access, plans for your business or a tool you'd like Baba to work with.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the team behind Baba"
        description="Questions about early access, plans or what Baba can do for your business? Send us a message and we'll get back to you."
      />

      <section className="pb-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">
          <div className="rounded-card border border-border bg-surface p-6 sm:p-8 lg:col-span-3">
            <h2 className="mb-6 text-xl font-semibold text-foreground">Send a message</h2>
            <ContactForm />
          </div>

          <aside className="space-y-6 lg:col-span-2" aria-label="Other ways to reach us">
            <div className="rounded-card border border-border bg-surface p-6">
              <div className="mb-3 flex items-center gap-3">
                <Mail aria-hidden="true" className="size-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Email</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Prefer email? Write to us at <span className="text-foreground">{legalConfig.contactEmail}</span>.
              </p>
            </div>

            <div className="rounded-card border border-border bg-surface p-6">
              <div className="mb-3 flex items-center gap-3">
                <UserPlus aria-hidden="true" className="size-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Early access</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Ready to try Baba?{" "}
                <Link href={routes.signUp} className="font-medium text-accent hover:underline">
                  Request access
                </Link>{" "}
                by creating an account. Our team reviews every new sign-up before the account can be used.
              </p>
            </div>

            <div className="rounded-card border border-border bg-surface p-6">
              <div className="mb-3 flex items-center gap-3">
                <Building2 aria-hidden="true" className="size-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Plans for your business</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                See the{" "}
                <Link href={routes.pricing} className="font-medium text-accent hover:underline">
                  plans
                </Link>{" "}
                we offer, then tell us about your team and we&apos;ll set up the right one with you.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
