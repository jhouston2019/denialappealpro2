"use client";

import { useMemo, useState } from "react";
import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import { ensureLedger } from "@/lib/appeal/ledger/intakeToLedger";
import { DEFAULT_ENCLOSURES } from "@/lib/appeal/ledger/keys";
import type { EnclosureItem, FactLedger, PlanType } from "@/lib/appeal/ledger/types";
import { routeDenial } from "@/lib/appeal/router/index";
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
  ledger: FactLedger | null;
  enclosures: EnclosureItem[];
  onIntakeChange: (patch: Partial<DenialIntake>) => void;
  onEnclosuresChange: (enclosures: EnclosureItem[]) => void;
  onBack: () => void;
  onContinue: () => void;
  isPreviewMode?: boolean;
  previewUnlockBusy?: boolean;
  onPreviewUnlock?: () => void;
  announce: (msg: string) => void;
};

const BUNDLING_BRANCH_OPTIONS: Array<{
  id: "modifier-59" | "no-ncci-edit" | "modifier-indicator-0";
  label: string;
}> = [
  {
    id: "modifier-59",
    label: "Modifier 59 / X{EPSU} applied — distinct procedural service",
  },
  {
    id: "no-ncci-edit",
    label: "No NCCI PTP edit exists for this code pair",
  },
  {
    id: "modifier-indicator-0",
    label:
      "NCCI edit exists but modifier indicator is 0 — challenging medical policy",
  },
];

const TIMELY_FILING_BRANCH_OPTIONS: Array<{
  id:
    | "proof-of-timely-submission"
    | "coordination-of-benefits"
    | "good-cause"
    | "plan-error";
  label: string;
}> = [
  {
    id: "proof-of-timely-submission",
    label: "Claim was submitted on time — have proof (clearinghouse report, ERA)",
  },
  {
    id: "coordination-of-benefits",
    label: "Delay caused by coordination of benefits with another payer",
  },
  {
    id: "good-cause",
    label: "Good cause exists for the delay (eligibility issue, disaster, etc.)",
  },
  {
    id: "plan-error",
    label: "Plan returned or rejected the claim in error, causing the delay",
  },
];

const AUTH_BRANCH_OPTIONS: Array<{
  id: "A" | "B" | "C" | "D";
  label: string;
}> = [
  { id: "A", label: "Authorization was obtained and the number is on file" },
  { id: "B", label: "Authorization was obtained for a different CPT code" },
  {
    id: "C",
    label: "Authorization applies to a different rendering provider or TIN",
  },
  { id: "D", label: "No prior authorization was obtained" },
];

const PLAN_TYPE_OPTIONS: Array<{ value: PlanType; label: string }> = [
  {
    value: "erisa-self-funded",
    label:
      "Employer plan — self-funded (the employer pays claims directly; often says \"Administrative Services Only\" or \"ASO\" on the member card)",
  },
  {
    value: "fully-insured-group",
    label:
      "Employer plan — fully insured (insurance company pays claims; state-regulated)",
  },
  { value: "medicare-advantage", label: "Medicare Advantage (Part C)" },
  { value: "medicaid-mco", label: "Medicaid managed care" },
  {
    value: "marketplace-individual",
    label: "Marketplace / individual (ACA exchange or direct purchase)",
  },
  { value: "unknown", label: "I'm not sure" },
];

export function Step3ConfirmPanel({
  intake,
  ledger,
  enclosures,
  onIntakeChange,
  onEnclosuresChange,
  onBack,
  onContinue,
  isPreviewMode = false,
  previewUnlockBusy = false,
  onPreviewUnlock,
  announce,
}: Props) {
  const [customLabel, setCustomLabel] = useState("");

  const workingLedger = useMemo(
    () => ensureLedger(ledger, intake, enclosures),
    [ledger, intake, enclosures]
  );
  const route = useMemo(() => routeDenial(workingLedger), [workingLedger]);
  const needsAuthBranch =
    route.strategy.id === "authorization" && !intake.authBranch;
  const needsBundlingBranch =
    route.strategy.id === "bundling" && !intake.bundlingBranch;
  const needsTimelyFilingBranch =
    route.strategy.id === "timely-filing" && !intake.timelyFilingBranch;
  const needsPlanType = intake.planType == null;
  const needsPrimaryDiagnosis =
    route.strategy.id === "medical-necessity" && !intake.primaryDiagnosis?.trim();

  const list =
    enclosures.length > 0
      ? enclosures
      : DEFAULT_ENCLOSURES.map((e) => ({
          id: e.id,
          label: e.label,
          checked: false,
        }));

  const toggle = (id: string) => {
    onEnclosuresChange(
      list.map((e) => (e.id === id ? { ...e, checked: !e.checked } : e))
    );
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    onEnclosuresChange([
      ...list,
      { id, label, checked: true, custom: true },
    ]);
    setCustomLabel("");
  };

  return (
    <section className={WIZARD_PANEL}>
      <h2 className="text-lg font-semibold text-[#1a2a3a]">Confirm details</h2>
      <p className="mt-1 text-sm text-[#5a6a7a]">
        Add provider and signer information, clinical facts you can verify, and
        enclosures before generating your appeal.
      </p>

      {intake.carcCodes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[#e4e4e4] bg-[#f8fafc] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8a9aaa]">
            Denial codes (CARC)
          </p>
          <p className="mt-1 text-sm text-[#1a2a3a]">
            {intake.carcCodes.join(", ")}
          </p>
          {route.primaryCarc ? (
            <p className="mt-2 text-sm text-[#5a6a7a]">
              {route.primaryCarc.descriptor}
            </p>
          ) : null}
        </div>
      ) : null}

      {route.strategy.id === "authorization" ? (
        <div className="mt-6 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-4">
          <h3 className="text-base font-semibold text-[#1a2a3a]">
            Authorization Status
          </h3>
          <p className="mt-1 text-sm text-[#5a6a7a]">
            What is the authorization status for this claim?
          </p>
          <fieldset className="mt-4 space-y-2">
            {AUTH_BRANCH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 text-sm text-[#1a2a3a]"
              >
                <input
                  type="radio"
                  name="authBranch"
                  value={opt.id}
                  checked={intake.authBranch === opt.id}
                  onChange={() => onIntakeChange({ authBranch: opt.id })}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold">{opt.id}</span> — {opt.label}
                </span>
              </label>
            ))}
          </fieldset>
          {needsAuthBranch ? (
            <p className="mt-3 text-sm font-medium text-[#b45309]" role="alert">
              Required before continuing
            </p>
          ) : null}
          {(intake.authBranch === "A" ||
            intake.authBranch === "B" ||
            intake.authBranch === "C") && (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold">
                Authorization number
              </span>
              <input
                value={intake.authorizationNumber}
                onChange={(e) =>
                  onIntakeChange({ authorizationNumber: e.target.value })
                }
                placeholder="Prior authorization / precertification number"
                style={inputStyle}
              />
            </label>
          )}
        </div>
      ) : null}

      ) : null}

      {route.strategy.id === "bundling" ? (
        <div className="mt-6 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-4">
          <h3 className="text-base font-semibold text-[#1a2a3a]">
            Separate Billing Basis
          </h3>
          <p className="mt-1 text-sm text-[#5a6a7a]">
            {route.strategy.branchQuestion}
          </p>
          <fieldset className="mt-4 space-y-2">
            {BUNDLING_BRANCH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 text-sm text-[#1a2a3a]"
              >
                <input
                  type="radio"
                  name="bundlingBranch"
                  value={opt.id}
                  checked={intake.bundlingBranch === opt.id}
                  onChange={() => onIntakeChange({ bundlingBranch: opt.id })}
                  className="mt-1"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>
          {needsBundlingBranch ? (
            <p className="mt-3 text-sm font-medium text-[#b45309]" role="alert">
              Required before continuing
            </p>
          ) : null}
        </div>
      ) : null}

      {route.strategy.id === "timely-filing" ? (
        <div className="mt-6 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-4">
          <h3 className="text-base font-semibold text-[#1a2a3a]">
            Timely Filing Basis
          </h3>
          <p className="mt-1 text-sm text-[#5a6a7a]">
            {route.strategy.branchQuestion}
          </p>
          <fieldset className="mt-4 space-y-2">
            {TIMELY_FILING_BRANCH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 text-sm text-[#1a2a3a]"
              >
                <input
                  type="radio"
                  name="timelyFilingBranch"
                  value={opt.id}
                  checked={intake.timelyFilingBranch === opt.id}
                  onChange={() =>
                    onIntakeChange({ timelyFilingBranch: opt.id })
                  }
                  className="mt-1"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>
          {needsTimelyFilingBranch ? (
            <p className="mt-3 text-sm font-medium text-[#b45309]" role="alert">
              Required before continuing
            </p>
          ) : null}
          {intake.timelyFilingBranch === "good-cause" ? (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold">
                Good cause description
              </span>
              <textarea
                rows={3}
                value={intake.goodCauseDescription}
                onChange={(e) =>
                  onIntakeChange({ goodCauseDescription: e.target.value })
                }
                placeholder="Describe the reason for the filing delay"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {route.strategy.id === "medical-necessity" ? (
        <div className="mt-6 rounded-lg border border-[#cbd5e1] bg-[#fffbeb] px-4 py-4">
          <p className="text-sm text-[#5a6a7a]">
            Medical necessity appeal: primary diagnosis is required. Conservative
            care tried and functional impact strengthen the argument significantly.
          </p>
        </div>
      ) : null}

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
          <span className="mb-1 block text-sm font-semibold">Signer name</span>
          <input
            value={intake.signerName}
            onChange={(e) => onIntakeChange({ signerName: e.target.value })}
            placeholder={intake.providerName || "Name on signature block"}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Signer title</span>
          <input
            value={intake.signerTitle}
            onChange={(e) => onIntakeChange({ signerTitle: e.target.value })}
            placeholder="e.g. Billing Manager"
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
            Primary diagnosis
            {route.strategy.id === "medical-necessity" ? " (required)" : " (optional)"}
          </span>
          <input
            value={intake.primaryDiagnosis}
            onChange={(e) =>
              onIntakeChange({ primaryDiagnosis: e.target.value })
            }
            placeholder="e.g. Primary osteoarthritis of right hip, M16.11"
            style={inputStyle}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            ICD-10 codes (optional — enter only if confirmed)
          </span>
          <input
            value={intake.icdCodes.join(", ")}
            onChange={(e) =>
              onIntakeChange({
                icdCodes: e.target.value
                  .split(/[,;\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="User-supplied only; never inferred from CPT"
            style={inputStyle}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Conservative care tried (optional)
          </span>
          <textarea
            rows={2}
            value={intake.conservativeCareTried}
            onChange={(e) =>
              onIntakeChange({ conservativeCareTried: e.target.value })
            }
            placeholder="e.g. Six months PT, NSAIDs, activity modification"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Functional impact (optional)
          </span>
          <textarea
            rows={2}
            value={intake.functionalImpact}
            onChange={(e) =>
              onIntakeChange({ functionalImpact: e.target.value })
            }
            placeholder="e.g. Unable to ambulate more than 50 feet without assistive device"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Clinical indication (optional)
          </span>
          <textarea
            rows={3}
            value={intake.medicalNecessity}
            onChange={(e) =>
              onIntakeChange({ medicalNecessity: e.target.value })
            }
            placeholder="Only facts you can verify from the record."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Additional context (optional)
          </span>
          <textarea
            rows={3}
            value={intake.additionalContext}
            onChange={(e) =>
              onIntakeChange({ additionalContext: e.target.value })
            }
            placeholder="Other verified facts to include."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </div>

      <div className="mt-8">
        <h3 className="text-base font-semibold text-[#1a2a3a]">
          Plan Type (required)
        </h3>
        <p className="mt-1 text-sm text-[#5a6a7a]">
          What type of health plan is this claim under?
        </p>
        <fieldset className="mt-4 space-y-2">
          {PLAN_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2 text-sm text-[#1a2a3a]"
            >
              <input
                type="radio"
                name="planType"
                value={opt.value}
                checked={intake.planType === opt.value}
                onChange={() => onIntakeChange({ planType: opt.value })}
                className="mt-1"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </fieldset>
        {intake.planType === "unknown" ? (
          <div className="mt-4 rounded-lg border border-[#e4e4e4] bg-[#fffbeb] px-4 py-3 text-sm text-[#5a6a7a]">
            <p className="font-semibold text-[#1a2a3a]">How to find out:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Check the member ID card — &quot;ASO&quot; or &quot;Administrative
                Services Only&quot; = self-funded
              </li>
              <li>
                Ask the employer&apos;s HR department whether the plan is
                self-funded
              </li>
              <li>
                Look at the Summary Plan Description (SPD) — self-funded plans
                reference ERISA
              </li>
              <li>If it&apos;s a union plan, it is almost always self-funded ERISA</li>
            </ul>
          </div>
        ) : null}
        {needsPlanType ? (
          <p className="mt-3 text-sm font-medium text-[#b45309]" role="alert">
            Required before continuing
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        <h3 className="text-base font-semibold text-[#1a2a3a]">Enclosures</h3>
        <p className="mt-1 text-sm text-[#5a6a7a]">
          Checked items appear in an Enclosures block after the letter. The
          letter body will not mention them.
        </p>
        <ul className="mt-4 space-y-2">
          {list.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <input
                id={`enc-${item.id}`}
                type="checkbox"
                checked={item.checked}
                onChange={() => toggle(item.id)}
                className="mt-1"
              />
              <label htmlFor={`enc-${item.id}`} className="text-sm text-[#1a2a3a]">
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Add custom enclosure"
            style={{ ...inputStyle, maxWidth: 360 }}
          />
          <button type="button" className="dap-btn-ghost-panel" onClick={addCustom}>
            Add custom enclosure
          </button>
        </div>
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
          disabled={
            needsAuthBranch ||
            needsBundlingBranch ||
            needsTimelyFilingBranch ||
            needsPlanType ||
            needsPrimaryDiagnosis
          }
          onClick={() => {
            if (needsPlanType) {
              announce("Select plan type before continuing.");
              return;
            }
            if (needsAuthBranch) {
              announce("Select authorization status before continuing.");
              return;
            }
            if (needsBundlingBranch) {
              announce("Select separate billing basis before continuing.");
              return;
            }
            if (needsTimelyFilingBranch) {
              announce("Select timely filing basis before continuing.");
              return;
            }
            if (needsPrimaryDiagnosis) {
              announce("Primary diagnosis is required for medical necessity appeals.");
              return;
            }
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
