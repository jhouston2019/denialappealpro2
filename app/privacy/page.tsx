import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Denial Appeal Pro",
  description: "Privacy Policy for Denial Appeal Pro healthcare appeal software.",
};

const EFFECTIVE_DATE = "July 31, 2026";
const PRIVACY_EMAIL = "privacy@denialappealpro.com";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p className="text-sm text-slate-500">
        <strong>Effective date:</strong> {EFFECTIVE_DATE}
      </p>

      <p className="mt-6">
        Denial Appeal Pro (&quot;DAP,&quot; &quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;) provides software that helps healthcare billing
        professionals and provider offices generate administrative appeal letters
        from denial letters and remittance data. This Privacy Policy describes
        how we collect, use, store, and protect information when you use our
        website and services.
      </p>

      <h2 className="mt-8 text-xl font-semibold">1. Information we collect</h2>
      <p className="mt-3">
        We may collect the following categories of information:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong>Account information:</strong> name, email address, password
          (stored via our authentication provider), and billing-related
          identifiers linked to your account.
        </li>
        <li>
          <strong>Payment information:</strong> payment method and transaction
          details are processed by Stripe. We do not store full payment card
          numbers on our servers.
        </li>
        <li>
          <strong>Uploaded documents and pasted text:</strong> denial letters,
          explanations of benefits (EOBs), remittance advice, and related
          billing documents you submit for extraction and appeal generation.
        </li>
        <li>
          <strong>Protected health information (PHI):</strong> documents you
          upload may contain PHI, including patient names, member/subscriber
          IDs, dates of birth, dates of service, diagnosis and procedure codes,
          and other identifiers appearing on payer correspondence.
        </li>
        <li>
          <strong>Generated content:</strong> extracted claim data, appeal
          letters, and export files you create through the service.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, device
          information, and usage logs necessary to operate and secure the
          service.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">2. How we use information</h2>
      <p className="mt-3">We use collected information solely to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Provide denial extraction, review, and appeal letter generation;</li>
        <li>Maintain your account, authenticate access, and enforce plan limits;</li>
        <li>Process payments and send transactional communications;</li>
        <li>Improve reliability, security, and product performance;</li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p className="mt-3">
        We do <strong>not</strong> sell your personal information or PHI. We do
        not use uploaded denial documents to train public AI models for
        unrelated purposes. Document content is processed only to deliver the
        appeal-generation service you request.
      </p>

      <h2 className="mt-8 text-xl font-semibold">3. Third-party processors</h2>
      <p className="mt-3">
        We use trusted subprocessors to operate the service. Each receives only
        the data necessary for its function:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong>Supabase</strong> — authentication, database storage, and
          access-controlled user data.
        </li>
        <li>
          <strong>OpenAI</strong> — AI-assisted extraction and appeal letter
          generation from content you submit.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing and subscription billing.
        </li>
        <li>
          <strong>Netlify</strong> — application hosting and serverless
          function execution.
        </li>
        <li>
          <strong>Resend</strong> (when configured) — transactional email
          delivery.
        </li>
      </ul>
      <p className="mt-3">
        These providers are contractually required to protect data and may only
        process it according to our instructions and applicable law.
      </p>

      <h2 className="mt-8 text-xl font-semibold">4. Data retention</h2>
      <p className="mt-3">
        Uploaded source documents and raw extraction inputs are retained for up
        to <strong>30 days</strong> to support appeal generation, account
        recovery, and dispute resolution, then deleted or anonymized unless a
        longer retention period is required by law or you have an active paid
        subscription with saved appeal history you choose to maintain.
      </p>
      <p className="mt-3">
        Account, billing, and audit records may be retained longer as needed for
        legal, tax, and security purposes.
      </p>

      <h2 className="mt-8 text-xl font-semibold">5. Security</h2>
      <p className="mt-3">
        We implement administrative, technical, and organizational safeguards
        including encryption in transit (TLS), encryption at rest via our cloud
        providers, role-based access controls, and authenticated API access.
        No method of transmission or storage is completely secure; you use the
        service at your own risk within these limits.
      </p>

      <h2 className="mt-8 text-xl font-semibold">6. Your rights</h2>
      <p className="mt-3">Depending on your jurisdiction, you may have the right to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Access personal information we hold about you;</li>
        <li>Request correction of inaccurate information;</li>
        <li>Request deletion of your account and associated data;</li>
        <li>Object to or restrict certain processing.</li>
      </ul>
      <p className="mt-3">
        To exercise these rights, email{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We will
        respond within a reasonable timeframe and may verify your identity before
        fulfilling requests.
      </p>

      <h2 className="mt-8 text-xl font-semibold">7. HIPAA notice</h2>
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        Denial Appeal Pro is a <strong>software tool provider</strong>, not a
        covered entity under HIPAA. When provider offices use DAP to process
        patient information from denial documents, the provider office typically
        acts as the <strong>covered entity</strong> and DAP may act as a{" "}
        <strong>business associate</strong> depending on the nature of the
        relationship and data flow.
      </p>
      <p className="mt-3">
        <strong>You are responsible for your own HIPAA compliance</strong>,
        including determining whether a Business Associate Agreement (BAA) is
        required, executing BAAs with us and our subprocessors where
        applicable, and ensuring you have a lawful basis to upload PHI into the
        service. See our{" "}
        <a href="/hipaa">HIPAA Notice</a> for subprocessors and BAA request
        information.
      </p>

      <h2 className="mt-8 text-xl font-semibold">8. Children</h2>
      <p className="mt-3">
        The service is intended for healthcare billing professionals and is not
        directed to individuals under 18. We do not knowingly collect information
        from children.
      </p>

      <h2 className="mt-8 text-xl font-semibold">9. Changes</h2>
      <p className="mt-3">
        We may update this Privacy Policy from time to time. Material changes
        will be posted on this page with an updated effective date.
      </p>

      <h2 className="mt-8 text-xl font-semibold">10. Contact</h2>
      <p className="mt-3">
        Privacy inquiries:{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
