import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "HIPAA Notice | Denial Appeal Pro",
  description: "HIPAA posture and Business Associate information for Denial Appeal Pro.",
};

const BAA_EMAIL = "baa@denialappealpro.com";

export default function HipaaPage() {
  return (
    <LegalPageShell title="HIPAA Notice">
      <p className="text-sm text-slate-500">
        <strong>Last updated:</strong> July 31, 2026
      </p>

      <p className="mt-6">
        This notice describes how Denial Appeal Pro (&quot;DAP&quot;) handles
        protected health information (PHI) when provider offices and billing
        professionals use our appeal-generation software.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Our role</h2>
      <p className="mt-3">
        DAP processes PHI contained in denial letters, EOBs, and remittance
        documents you upload — including patient names, member IDs, dates of
        service, and clinical/billing codes. Provider offices and covered
        entities typically remain responsible for HIPAA compliance for their
        patients&apos; information.
      </p>
      <p className="mt-3">
        When a covered entity transmits PHI to DAP for appeal generation, DAP
        may act as a <strong>Business Associate</strong> under HIPAA. Covered
        entities are responsible for determining whether a BAA is required and
        for obtaining patient authorization or another lawful basis to disclose
        PHI to us.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Business Associate Agreement (BAA)</h2>
      <p className="mt-3">
        Covered entities and business associates that require a BAA with DAP may
        request one by emailing{" "}
        <a href={`mailto:${BAA_EMAIL}`}>{BAA_EMAIL}</a>. Include your
        organization name, primary contact, and estimated usage. We will respond
        with BAA terms appropriate to your deployment.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Subprocessors and BAA status</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2 font-semibold">Provider</th>
              <th className="px-3 py-2 font-semibold">Function</th>
              <th className="px-3 py-2 font-semibold">PHI / BAA notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-3 font-medium">Supabase</td>
              <td className="px-3 py-3">Database, authentication, storage</td>
              <td className="px-3 py-3">
                BAA available on HIPAA-eligible Supabase plans (Team/Enterprise).
                Customers must enable HIPAA add-on and sign Supabase&apos;s BAA.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-medium">OpenAI</td>
              <td className="px-3 py-3">AI extraction and letter generation</td>
              <td className="px-3 py-3">
                BAA available under OpenAI Enterprise agreements. The standard
                API is not intended for PHI unless covered by a signed BAA.
                De-identify documents before upload if you are not on an
                Enterprise/BAA-covered plan.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-medium">Netlify</td>
              <td className="px-3 py-3">Hosting and serverless functions</td>
              <td className="px-3 py-3">
                BAA available on Netlify Business or Enterprise plans. Production
                deployments handling PHI should use a BAA-covered Netlify tier.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-medium">Stripe</td>
              <td className="px-3 py-3">Payment processing</td>
              <td className="px-3 py-3">
                Processes billing and account data only — not PHI from uploaded
                denial documents. Stripe maintains PCI-DSS compliance for payment
                data.
              </td>
            </tr>
            <tr>
              <td className="px-3 py-3 font-medium">Resend</td>
              <td className="px-3 py-3">Transactional email</td>
              <td className="px-3 py-3">
                Sends account and payment emails. Do not include PHI in email
                content. Evaluate BAA requirements if email templates ever
                contain patient-specific information.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Security practices</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Encryption in transit (TLS 1.2+) for all web and API traffic;</li>
        <li>Encryption at rest via cloud provider infrastructure;</li>
        <li>Role-based access controls and authenticated sessions;</li>
        <li>Row-level security on user data in the database layer;</li>
        <li>
          Uploaded source documents retained up to 30 days unless longer retention
          is required for active accounts or legal obligations;
        </li>
        <li>Rate limiting and monitoring on public endpoints.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Your responsibilities</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Determine whether a BAA with DAP is required for your use case;</li>
        <li>
          Execute BAAs with DAP and applicable subprocessors before uploading
          PHI;
        </li>
        <li>
          Use minimum necessary PHI — redact or de-identify when full identifiers
          are not required;
        </li>
        <li>Review all generated letters before submission to payers;</li>
        <li>Maintain your own workforce training and access policies.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3">
        BAA requests and HIPAA questions:{" "}
        <a href={`mailto:${BAA_EMAIL}`}>{BAA_EMAIL}</a>
      </p>
      <p className="mt-2">
        See also our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPageShell>
  );
}
