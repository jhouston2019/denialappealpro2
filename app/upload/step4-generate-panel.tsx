"use client";

import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

type Props = {
  intake: DenialIntake;
  generateLoading: boolean;
  onBack: () => void;
  onGenerate: () => void;
  announce: (msg: string) => void;
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#eef2f6] py-2 sm:flex-row sm:gap-4">
      <span className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-[#8a9aaa]">
        {label}
      </span>
      <span className="text-sm text-[#1a2a3a]">{value}</span>
    </div>
  );
}

export function Step4GeneratePanel({
  intake,
  generateLoading,
  onBack,
  onGenerate,
  announce,
}: Props) {
  return (
    <section className={WIZARD_PANEL}>
      <h2 className="text-lg font-semibold text-[#1a2a3a]">Generate appeal</h2>
      <p className="mt-1 text-sm text-[#5a6a7a]">
        Review your claim summary, then generate your formal appeal letter.
      </p>

      <div className="mt-6 rounded-lg border border-[#e4e4e4] bg-[#f8fafc] px-4 py-2">
        <SummaryRow label="Patient" value={intake.patientName} />
        <SummaryRow label="Payer" value={intake.payer} />
        <SummaryRow label="Claim" value={intake.claimNumber} />
        <SummaryRow label="DOS" value={intake.dateOfService} />
        <SummaryRow label="Provider" value={intake.providerName} />
        <SummaryRow label="NPI" value={intake.providerNpi} />
        <SummaryRow
          label="CARC / RARC"
          value={[...intake.carcCodes, ...intake.rarcCodes].join(", ")}
        />
        <SummaryRow
          label="CPT / ICD-10"
          value={[...intake.cptCodes, ...intake.icdCodes].join(", ")}
        />
        <SummaryRow
          label="Billed / Paid"
          value={`$${intake.billedAmount || "0"} / $${intake.paidAmount || "0"}`}
        />
        {intake.denialReason ? (
          <div className="py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#8a9aaa]">
              Denial reason
            </span>
            <p className="mt-1 text-sm text-[#1a2a3a]">{intake.denialReason}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="dap-btn-ghost-panel"
          onClick={onBack}
          disabled={generateLoading}
        >
          Back
        </button>
        <button
          type="button"
          className="dap-btn-cta"
          disabled={generateLoading}
          onClick={() => {
            announce("Generating appeal letter…");
            onGenerate();
          }}
        >
          {generateLoading ? "Generating…" : "Generate Appeal Letter"}
        </button>
      </div>
    </section>
  );
}
