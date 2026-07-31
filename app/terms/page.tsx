import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service | Denial Appeal Pro",
  description: "Terms of Service for Denial Appeal Pro.",
};

const EFFECTIVE_DATE = "July 31, 2026";
const LEGAL_EMAIL = "legal@denialappealpro.com";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <p className="text-sm text-slate-500">
        <strong>Effective date:</strong> {EFFECTIVE_DATE}
      </p>

      <div className="mt-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-950">
          Not legal advice
        </p>
        <p className="mt-2 text-sm text-amber-900">
          Denial Appeal Pro is <strong>not a law firm</strong> and does not
          provide legal advice. Generated appeal letters are tools for
          administrative billing correspondence only. You are solely responsible
          for reviewing, editing, and submitting any document produced by the
          service.
        </p>
      </div>

      <h2 className="mt-8 text-xl font-semibold">1. Agreement</h2>
      <p className="mt-3">
        By accessing or using Denial Appeal Pro (&quot;DAP,&quot; the
        &quot;Service&quot;), you agree to these Terms of Service
        (&quot;Terms&quot;). If you do not agree, do not use the Service.
      </p>

      <h2 className="mt-8 text-xl font-semibold">2. Service description</h2>
      <p className="mt-3">
        DAP provides software that extracts structured data from healthcare
        denial documents and generates draft administrative appeal letters for
        review and export. The Service assists billing workflows; it does not
        guarantee payer reversal, payment, or any particular outcome.
      </p>

      <h2 className="mt-8 text-xl font-semibold">3. Eligibility and acceptable use</h2>
      <p className="mt-3">You may use the Service only if you are:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          A healthcare billing professional, revenue cycle team member, provider
          office staff, or patient acting on your own claim; and
        </li>
        <li>
          At least 18 years old and authorized to bind your organization, if
          applicable.
        </li>
      </ul>
      <p className="mt-3">You agree not to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          Use the Service to prepare or submit fraudulent, false, or misleading
          claims or appeals;
        </li>
        <li>
          Upload documents you are not authorized to process, including PHI
          without appropriate consent and HIPAA safeguards;
        </li>
        <li>
          Reverse engineer, scrape, overload, or abuse the Service or its APIs;
        </li>
        <li>Violate applicable law, payer rules, or professional standards.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">4. No guarantee of outcomes</h2>
      <p className="mt-3">
        DAP does <strong>not</strong> guarantee that any appeal will succeed,
        that a payer will reverse a denial, or that any specific reimbursement
        amount will be obtained. Appeal outcomes depend on payer policy, clinical
        records, timely filing, and factors outside our control.
      </p>

      <h2 className="mt-8 text-xl font-semibold">5. Payment terms</h2>
      <p className="mt-3">
        Paid plans and single-appeal purchases are billed through Stripe. Fees
        are disclosed at checkout. Except where required by applicable law,{" "}
        <strong>all sales are final once an appeal letter has been generated</strong>{" "}
        under your account, because generation consumes AI processing and plan
        credits. Subscription fees are non-refundable for partial billing
        periods unless we state otherwise in writing.
      </p>

      <h2 className="mt-8 text-xl font-semibold">6. Account security</h2>
      <p className="mt-3">
        You are responsible for safeguarding login credentials and for all
        activity under your account. Notify us promptly of unauthorized access.
      </p>

      <h2 className="mt-8 text-xl font-semibold">7. Intellectual property</h2>
      <p className="mt-3">
        We retain ownership of the Service, software, and documentation. You
        retain ownership of content you upload. Subject to these Terms, we grant
        you a limited license to use generated letters for your legitimate
        billing and appeal purposes.
      </p>

      <h2 className="mt-8 text-xl font-semibold">8. Termination</h2>
      <p className="mt-3">
        You may stop using the Service at any time. We may suspend or terminate
        access if you breach these Terms, fail to pay applicable fees, or if
        continued provision poses legal, security, or operational risk. Upon
        termination, provisions that by nature should survive (including
        disclaimers and limitations of liability) will remain in effect.
      </p>

      <h2 className="mt-8 text-xl font-semibold">9. Disclaimer of warranties</h2>
      <p className="mt-3 uppercase text-sm">
        The service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, whether express or implied, including
        implied warranties of merchantability, fitness for a particular purpose,
        accuracy, or non-infringement.
      </p>

      <h2 className="mt-8 text-xl font-semibold">10. Limitation of liability</h2>
      <p className="mt-3 uppercase text-sm">
        To the maximum extent permitted by law, denial appeal pro and its
        affiliates, officers, and suppliers shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for lost
        profits, revenue, data, or goodwill, arising from your use of the
        service. Our total liability for any claim relating to the service shall
        not exceed the greater of (a) amounts you paid to us in the twelve (12)
        months before the claim or (b) one hundred u.s. dollars (usd $100).
      </p>

      <h2 className="mt-8 text-xl font-semibold">11. Indemnification</h2>
      <p className="mt-3">
        You agree to indemnify and hold harmless DAP from claims arising out of
        your uploaded content, your use of generated letters, your violation of
        these Terms, or your violation of applicable law.
      </p>

      <h2 className="mt-8 text-xl font-semibold">12. Governing law</h2>
      <p className="mt-3">
        These Terms are governed by the laws of the State of Delaware, United
        States, without regard to conflict-of-law principles. Exclusive venue for
        disputes shall be state or federal courts located in Delaware, except
        where prohibited by law.
      </p>

      <h2 className="mt-8 text-xl font-semibold">13. Changes</h2>
      <p className="mt-3">
        We may modify these Terms by posting an updated version on this page.
        Continued use after changes constitutes acceptance.
      </p>

      <h2 className="mt-8 text-xl font-semibold">14. Contact</h2>
      <p className="mt-3">
        Questions about these Terms:{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
