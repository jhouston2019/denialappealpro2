"use client";

import CodeMultiInput from "@/components/wizard/CodeMultiInput";
import type { DapConfidenceMap } from "@/lib/dap-wizard-snapshot";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import type { FieldConfidence } from "@/lib/dap-wizard-snapshot";

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

function fieldStyle(confidence: FieldConfidence): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: confidence === "high" ? "2px solid #22c55e" : "2px solid #f97316",
    background: confidence === "low" ? "#fff7ed" : "#fff",
    fontSize: 16,
    boxSizing: "border-box",
  };
}

type Props = {
  intake: DenialIntake;
  confidence: DapConfidenceMap;
  onIntakeChange: (patch: Partial<DenialIntake>) => void;
  onBack: () => void;
  onNext: () => void;
  announce: (msg: string) => void;
};

export function Step2ExtractionPanel({
  intake,
  confidence,
  onIntakeChange,
  onBack,
  onNext,
  announce,
}: Props) {
  return (
    <section className={WIZARD_PANEL}>
      <h2 className="text-lg font-semibold text-[#1a2a3a]">Review extraction</h2>
      <p className="mt-1 text-sm text-[#5a6a7a]">
        Verify each field. Green borders indicate high confidence; orange means
        please double-check.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Patient name</span>
          <input
            value={intake.patientName}
            onChange={(e) => onIntakeChange({ patientName: e.target.value })}
            style={fieldStyle(confidence.patientName)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Payer</span>
          <input
            value={intake.payer}
            onChange={(e) => onIntakeChange({ payer: e.target.value })}
            style={fieldStyle(confidence.payerName)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Claim number</span>
          <input
            value={intake.claimNumber}
            onChange={(e) => onIntakeChange({ claimNumber: e.target.value })}
            style={fieldStyle(confidence.claimNumber)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Date of service</span>
          <input
            value={intake.dateOfService}
            onChange={(e) => onIntakeChange({ dateOfService: e.target.value })}
            style={fieldStyle(confidence.dateOfService)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Denial reason</span>
          <textarea
            rows={3}
            value={intake.denialReason}
            onChange={(e) => onIntakeChange({ denialReason: e.target.value })}
            style={{ ...fieldStyle(confidence.denialReason), resize: "vertical" }}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <CodeMultiInput
          label="CARC codes"
          values={intake.carcCodes}
          onChange={(carcCodes) => onIntakeChange({ carcCodes })}
          confidence={confidence.carcCodes}
          id="carc-codes"
        />
        <CodeMultiInput
          label="RARC codes"
          values={intake.rarcCodes}
          onChange={(rarcCodes) => onIntakeChange({ rarcCodes })}
          confidence={confidence.rarcCodes}
          id="rarc-codes"
        />
        <CodeMultiInput
          label="CPT codes"
          values={intake.cptCodes}
          onChange={(cptCodes) => onIntakeChange({ cptCodes })}
          confidence={confidence.cptCodes}
          id="cpt-codes"
        />
        <CodeMultiInput
          label="ICD-10 codes"
          values={intake.icdCodes}
          onChange={(icdCodes) => onIntakeChange({ icdCodes })}
          confidence={confidence.icd10Codes}
          id="icd-codes"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Billed amount</span>
          <input
            value={intake.billedAmount}
            onChange={(e) => onIntakeChange({ billedAmount: e.target.value })}
            style={fieldStyle(confidence.billedAmount)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Paid amount</span>
          <input
            value={intake.paidAmount}
            onChange={(e) => onIntakeChange({ paidAmount: e.target.value })}
            style={fieldStyle(confidence.paidAmount)}
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="dap-btn-ghost-panel" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="dap-btn-cta"
          onClick={() => {
            announce("Extraction reviewed. Confirm provider details next.");
            onNext();
          }}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
