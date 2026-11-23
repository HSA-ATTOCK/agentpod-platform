import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { legalConfig as c } from "@/config/legal";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          This policy explains what personal data {c.companyName} (&ldquo;we&rdquo;) collects when you use Baba, why, who
          we share it with, and your rights. Contact us at {c.contactEmail} with any questions.
        </p>
      </section>

      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address, password (stored only as a secure hash), and
            optional job title, phone number, photo, language and timezone.
          </li>
          <li>
            <strong>Workspace details:</strong> workspace name, industry, company size, logo, team members and their
            roles, and the business instructions you give Baba.
          </li>
          <li>
            <strong>Your work:</strong> messages you send Baba, files you attach, the answers and files Baba creates, and
            workflows you save.
          </li>
          <li>
            <strong>Usage records:</strong> tasks run, their steps, cost and status; sign-in times; basic technical data
            such as browser type and IP address used for security.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Why we use it</h2>
        <ul>
          <li>to provide the Service: carrying out the tasks you ask for and keeping your history;</li>
          <li>to keep accounts and workspaces secure and separate from each other;</li>
          <li>to send emails you need or asked for (verification, password resets, invites, task notifications);</li>
          <li>to enforce spending limits and these terms, and to fix problems.</li>
        </ul>
        <p>We do not sell your data and do not use your content for advertising.</p>
      </section>

      <section>
        <h2>3. Who processes it for us</h2>
        <ul>
          <li>
            <strong>Anthropic</strong> (Claude AI models): receives your messages, business instructions and attached
            files to carry out tasks. Anthropic&apos;s commercial terms state that this data is not used to train its
            models.
          </li>
          <li>
            <strong>Supabase</strong>: hosts our database, sign-in and file storage.
          </li>
          <li>
            <strong>Google</strong>: sends our emails (Gmail) and, if you choose it, lets you sign in with Google.
          </li>
          <li>Our hosting provider, which runs the website.</li>
        </ul>
        <p>These providers may process data outside {c.country}, under appropriate safeguards.</p>
      </section>

      <section>
        <h2>4. How long we keep it</h2>
        <p>
          We keep your data while your account or workspace exists. When you delete a conversation, workspace or your
          account, the related data is deleted from our database straight away and from backups within a limited period.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          Depending on where you live, you can ask to access, correct, delete or export your personal data, or object to
          how we use it. You can edit or delete most data yourself in the app (Profile and Settings). For anything else,
          email {c.contactEmail}. You can also complain to your local data protection authority.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Data is encrypted in transit, each workspace is isolated with database-level access rules, sensitive actions
          need your approval, and you can turn on two-step verification for your account.
        </p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>
          We only use cookies needed to keep you signed in and remember your current workspace. We don&apos;t use
          advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We&apos;ll tell you in the app or by email before making significant changes to this policy. See also our{" "}
          <Link href={routes.terms} className="text-accent hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
