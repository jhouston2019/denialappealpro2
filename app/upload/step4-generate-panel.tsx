"use client";

import { useMemo, useState } from "react";
import { primaryCarcDescriptor } from "@/lib/appeal/format/render";
import { sanitizeCarcDescription } from "@/lib/appeal/format/sanitizeCodes";
import { lookupCarc } from "@/lib/appeal/router/carc-table";
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

function isMedicalNecessityStrategy(carcCodes: string[]): boolean {
  for (const code of carcCodes) {
    const entry = lookupCarc(code);
    if (entry?.strategyId === "medical-necessity") return true;
  }
  return false;
}

function clinicalFieldsEmpty(intake: DenialIntake): boolean {
  return (
    !intake.conservativeCareTried?.trim() &&
    !intake.functionalImpact?.trim() &&
    !intake.medicalNecessity?.trim()
  );
}

export function Step4GeneratePanel({
  intake,
  generateLoading,
  onBack,
  onGenerate,
  announce,
}: Props) {
  const [showClinicalConfirm, setShowClinicalConfirm] = useState(false);

  const isMedicalNecessity = useMemo(
    () => isMedicalNecessityStrategy(intake.carcCodes),
    [intake.carcCodes]
  );
  const carcDescriptor = useMemo(
    () => primaryCarcDescriptor(intake.carcCodes),
    [intake.carcCodes]
  );
  const denialReasonDisplay = intake.denialReason
    ? sanitizeCarcDescription(intake.denialReason)
    : "";

  const proceedGenerate = () => {
    announce("Generating appeal letter…");
    onGenerate();
  };

  const handleGenerateClick = () => {
    if (isMedicalNecessity && clinicalFieldsEmpty(intake)) {
      setShowClinicalConfirm(true);
      return;
    }
    proceedGenerate();
  };

  return (
    <>
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
          {carcDescriptor ? (
            <SummaryRow label="CARC description" value={carcDescriptor} />
          ) : null}
          <SummaryRow
            label="CPT / ICD-10"
            value={[...intake.cptCodes, ...intake.icdCodes].join(", ")}
          />
          <SummaryRow
            label="Billed / Paid"
            value={`$${intake.billedAmount || "0"} / $${intake.paidAmount || "0"}`}
          />
          {denialReasonDisplay ? (
            <div className="py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8a9aaa]">
                Denial reason
              </span>
              <p className="mt-1 text-sm text-[#1a2a3a]">{denialReasonDisplay}</p>
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
            onClick={handleGenerateClick}
          >
            {generateLoading ? "Generating…" : "Generate Appeal Letter"}
          </button>
        </div>
      </section>

      {showClinicalConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinical-confirm-title"
        >
          <div className="max-w-md rounded-lg border border-[#e4e4e4] bg-white p-6 shadow-lg">
            <h3
              id="clinical-confirm-title"
              className="text-lg font-semibold text-[#1a2a3a]"
            >
              Generate without clinical details?
            </h3>
            <p className="mt-3 text-sm text-[#5a6a7a]">
              Your letter will be generated without clinical details. Medical
              necessity appeals are significantly stronger with documented
              conservative care, functional impact, and clinical indication.
              Continue anyway?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="dap-btn-ghost-panel"
                onClick={() => setShowClinicalConfirm(false)}
              >
                Add clinical details
              </button>
              <button
                type="button"
                className="dap-btn-cta"
                disabled={generateLoading}
                onClick={() => {
                  setShowClinicalConfirm(false);
                  proceedGenerate();
                }}
              >
                Generate anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
