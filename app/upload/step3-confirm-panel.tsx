"use client";

import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid #cbd5e1",
  fontSize: 16,
  boxSizing: "border-box",
};

type Props = {
  intake: DenialIntake;
  onIntakeChange: (patch: Partial<DenialIntake>) => void;
  onBack: () => void;
  onContinue: () => void;
  isPreviewMode?: boolean;
  previewUnlockBusy?: boolean;
  onPreviewUnlock?: () => void;
  announce: (msg: string) => void;
};

export function Step3ConfirmPanel({
  intake,
  onIntakeChange,
  onBack,
  onContinue,
  isPreviewMode = false,
  previewUnlockBusy = false,
  onPreviewUnlock,
  announce,
}: Props) {
  return (
    <section className={WIZARD_PANEL}>
      <h2 className="text-lg font-semibold text-[#1a2a3a]">Confirm details</h2>
      <p className="mt-1 text-sm text-[#5a6a7a]">
        Add provider information and any context before generating your appeal.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Provider name</span>
          <input
            value={intake.providerName}
            onChange={(e) => onIntakeChange({ providerName: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Provider NPI</span>
          <input
            value={intake.providerNpi}
            onChange={(e) => onIntakeChange({ providerNpi: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Provider address</span>
          <input
            value={intake.providerAddress}
            onChange={(e) => onIntakeChange({ providerAddress: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Provider phone</span>
          <input
            value={intake.providerPhone}
            onChange={(e) => onIntakeChange({ providerPhone: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Provider fax</span>
          <input
            value={intake.providerFax}
            onChange={(e) => onIntakeChange({ providerFax: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Billed amount</span>
          <input
            value={intake.billedAmount}
            onChange={(e) => onIntakeChange({ billedAmount: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Paid amount</span>
          <input
            value={intake.paidAmount}
            onChange={(e) => onIntakeChange({ paidAmount: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Additional context (optional)
          </span>
          <textarea
            rows={4}
            value={intake.additionalContext}
            onChange={(e) =>
              onIntakeChange({ additionalContext: e.target.value })
            }
            placeholder="Clinical notes, prior auth details, or other facts to include in the appeal."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </div>

      {isPreviewMode && onPreviewUnlock ? (
        <PreviewPaywallBlock
          onUnlock={onPreviewUnlock}
          busy={previewUnlockBusy}
        />
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="dap-btn-ghost-panel" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="dap-btn-cta"
          onClick={() => {
            announce("Details confirmed.");
            onContinue();
          }}
        >
          Continue to generate
        </button>
      </div>
    </section>
  );
}
