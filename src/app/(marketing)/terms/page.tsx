import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { legalConfig as c } from "@/config/legal";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <p>
          These terms are an agreement between you (and the business you represent) and {c.companyName}, of{" "}
          {c.companyAddress} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), for your use of Baba, an AI assistant that carries out
          tasks for businesses (the &ldquo;Service&rdquo;). By creating an account or using the Service you agree to them.
        </p>
      </section>

      <section>
        <h2>1. Your account</h2>
        <ul>
          <li>You must be at least 18 and able to agree to these terms for your business.</li>
          <li>Keep your sign-in details safe. You are responsible for everything done with your account.</li>
          <li>
            Workspace owners and admins decide who can use their workspace and what role each person has. Each workspace
            is kept separate from every other workspace.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. What Baba does</h2>
        <p>
          Baba uses AI models to research, write, analyse data and create files based on your instructions. AI can make
          mistakes: answers may be incomplete, out of date or wrong. Check important information, especially legal,
          financial, medical or safety matters, before you rely on it. Baba asks for your approval before sensitive
          actions such as sending messages on your behalf; you are responsible for actions you approve.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <p>You must not use the Service to:</p>
        <ul>
          <li>break any law, or infringe anyone&apos;s rights, including intellectual property and privacy;</li>
          <li>create or spread malware, spam, fraud, harassment or deceptive content;</li>
          <li>try to access other workspaces, other people&apos;s data, or our systems without permission;</li>
          <li>overload, disrupt, or reverse engineer the Service;</li>
          <li>break the usage policies of the AI providers we use (for example Anthropic&apos;s usage policy).</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </section>

      <section>
        <h2>4. Your content</h2>
        <p>
          You keep ownership of what you give Baba (messages, files, business details) and of what Baba creates for you,
          to the extent the law allows. You give us permission to store and process that content only to run the Service
          for you. You are responsible for having the right to share any content you give Baba.
        </p>
      </section>

      <section>
        <h2>5. Spending, fees and limits</h2>
        <p>
          Each workspace has a spending cap per conversation and a monthly limit, set in Settings. Tasks pause or stop
          when these are reached. During testing the Service is provided free of charge; if we introduce paid plans we
          will show the prices and ask you to agree before charging you.
        </p>
      </section>

      <section>
        <h2>6. Availability and changes</h2>
        <p>
          We work to keep the Service available but don&apos;t promise it will be uninterrupted or error-free. We may
          change or discontinue features. If we change these terms in a significant way we will tell you in the app or by
          email before the change takes effect.
        </p>
      </section>

      <section>
        <h2>7. Ending your use</h2>
        <p>
          You can delete your account at any time from your Profile, and owners can delete a workspace from Settings.
          Deleting removes the related conversations, files and history. We may close accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>8. Liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect or
          consequential losses, or for decisions made using AI output, and our total liability is limited to the amount
          you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited
          by law.
        </p>
      </section>

      <section>
        <h2>9. Governing law</h2>
        <p>These terms are governed by the laws of {c.country}, and its courts have jurisdiction.</p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these terms: {c.contactEmail}. See also our{" "}
          <Link href={routes.privacy} className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
