"use client";

import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import {
  formatStrategyLabel,
  type AnalysisResult,
} from "./step2-analysis-panel";

type Props = {
  analysis: AnalysisResult | null;
  strategy: string | null;
  onStrategyChange: (code: string) => void;
  onBack: () => void;
  onNext: () => void | Promise<void>;
  continueLoading?: boolean;
  announce: (message: string) => void;
  isPreviewMode?: boolean;
  onPreviewUnlock?: () => void;
  previewUnlockBusy?: boolean;
};

function splitFirstSentence(text: string): { first: string; rest: string } {
  const t = text.trim();
  if (t.length === 0) return { first: "", rest: "" };
  const i = t.search(/[.!?](\s|$)/);
  if (i === -1) return { first: t, rest: "" };
  return {
    first: t.slice(0, i + 1).trim(),
    rest: t.slice(i + 1).trim(),
  };
}

const BLUR = "filter blur-[4px] select-none [pointer-events:none]";

function previewSplitParagraph(full: string) {
  const { first, rest } = splitFirstSentence(full);
  if (!rest) return <>{full}</>;
  return (
    <>
      {first}{" "}
      <span className={BLUR}>{rest}</span>
    </>
  );
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function riskSentence(level: AnalysisResult["riskLevel"]): string {
  if (level === "low") return "The analysis rated overall risk as low.";
  if (level === "high") return "The analysis rated overall risk as high.";
  return "The analysis rated overall risk as moderate.";
}

function buildAutoRationale(analysis: AnalysisResult): string {
  const { carrierAmount, trueLossRange, riskLevel, recommendedStrategy } =
    analysis;
  const { low, high } = trueLossRange;
  const bandMid = (low + high) / 2;
  const gapToMid = bandMid - carrierAmount;
  const gapNote =
    Number.isFinite(gapToMid) && Math.abs(gapToMid) > 0.01
      ? ` The midpoint of the modeled true-loss band is ${formatMoney(bandMid)}, which differs from the extracted carrier total by about ${formatMoney(Math.abs(gapToMid))}.`
      : "";
  return (
    `Extracted carrier total ${formatMoney(carrierAmount)}; modeled true-loss range ${formatMoney(low)} to ${formatMoney(high)}.${gapNote} ${riskSentence(riskLevel)} The analysis output recommends ${formatStrategyLabel(recommendedStrategy)} given these modeled figures and the listed findings (not legal advice).`
  );
}

function cardRationale(
  code: string,
  analysis: AnalysisResult | null
): string {
  if (!analysis) {
    return "Run analysis on Step 1 to populate strategy context.";
  }
  const nOmit = analysis.scopeOmissions.length;
  const nPrice = analysis.pricingFlags.length;
  const nAngles = analysis.disputeAngles.length;
  const base = `Based on the same analysis: ${nOmit} scope omission note(s), ${nPrice} pricing flag(s), ${nAngles} dispute angle(s).`;
  switch (code) {
    case "FULL_SUPPLEMENT_DEMAND":
      return `${base} A full supplement demand aligns when line-item gaps and omissions are the main drivers.`;
    case "PARTIAL_DISPUTE":
      return `${base} A partial dispute fits when only part of the scope or dollars remains contested.`;
    case "DEMAND_REINSPECTION":
      return `${base} Re-inspection is appropriate when scope or field conditions need verification before dollars are finalized.`;
    case "INVOKE_APPRAISAL":
      return `${base} Appraisal may apply when valuation remains materially apart after documented findings.`;
    case "OTHER_CUSTOM":
      return `${base} A custom path covers outcomes that do not match the other four templates.`;
    default:
      return base;
  }
}

function cardRisk(analysis: AnalysisResult | null): string {
  if (!analysis) return "—";
  return `Risk level from analysis: ${analysis.riskLevel}.`;
}

function cardOutcome(code: string, analysis: AnalysisResult | null): string {
  if (!analysis) return "—";
  const { low, high } = analysis.trueLossRange;
  switch (code) {
    case "FULL_SUPPLEMENT_DEMAND":
      return `Aim to align payment closer to the modeled band (${formatMoney(low)}–${formatMoney(high)}) via documented line items.`;
    case "PARTIAL_DISPUTE":
      return "Target a narrower set of line items or dollar items still in contention.";
    case "DEMAND_REINSPECTION":
      return "Seek a revised scope or photos-supported review before finalizing totals.";
    case "INVOKE_APPRAISAL":
      return "Use when valuation remains materially apart after the documented line findings.";
    case "OTHER_CUSTOM":
      return "Define the next action in writing using the analysis lists as support.";
    default:
      return "—";
  }
}

type CardDef = {
  id: string;
  key: string;
  code: string;
};

const STRATEGY_CARDS: CardDef[] = [
  { id: "erp-step4-card-full-supplement", key: "full-supplement", code: "FULL_SUPPLEMENT_DEMAND" },
  { id: "erp-step4-card-partial-dispute", key: "partial-dispute", code: "PARTIAL_DISPUTE" },
  { id: "erp-step4-card-reinspection", key: "reinspection", code: "DEMAND_REINSPECTION" },
  { id: "erp-step4-card-appraisal", key: "appraisal", code: "INVOKE_APPRAISAL" },
  { id: "erp-step4-card-other", key: "other", code: "OTHER_CUSTOM" },
];

export function Step4StrategyPanel({
  analysis,
  strategy,
  onStrategyChange,
  onBack,
  onNext,
  continueLoading = false,
  announce,
  isPreviewMode = false,
  onPreviewUnlock,
  previewUnlockBusy = false,
}: Props) {
  const handleNext = async () => {
    if (!strategy) {
      announce("Choose a strategy before continuing.");
      return;
    }
    if (continueLoading) return;
    await onNext();
  };

  return (
    <div className="text-[#2a3a4a]">
      <h2
        id="erp-step4-heading"
        className="text-2xl font-bold text-[#1a2a3a]"
      >
        Step 4 — Strategy
      </h2>

      <aside
        id="erp-step4-auto-rationale"
        className="mt-6 rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white p-4 text-sm leading-relaxed text-[#2a3a4a]"
      >
        {analysis ? (
          buildAutoRationale(analysis)
        ) : (
          "No analysis is loaded. Return to earlier steps to run analysis before choosing a strategy."
        )}
      </aside>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {STRATEGY_CARDS.map(({ id, key, code }) => {
          const selected = strategy === code;
          const recommended =
            analysis?.recommendedStrategy === code;
          return (
            <div
              key={id}
              id={id}
              role="button"
              tabIndex={0}
              onClick={() => onStrategyChange(code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onStrategyChange(code);
                }
              }}
              className={`relative cursor-pointer rounded-[10px] p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a050] ${
                selected
                  ? "border-2 border-[#f0a050] bg-[#fffaf4] shadow-sm"
                  : "border-[0.5px] border-[#e0e0dc] bg-white hover:border-[#c8d4e0]"
              }`}
            >
              {recommended && (
                <span className="absolute right-3 top-3 rounded-full bg-[#f0a050] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Recommended
                </span>
              )}
              <div
                id={`erp-step4-card-${key}-title`}
                className="pr-24 text-base font-semibold text-[#1a2a3a]"
              >
                {formatStrategyLabel(code)}
              </div>
              <p
                id={`erp-step4-card-${key}-rationale`}
                className="mt-2 text-sm text-[#6a7a8a]"
              >
                {cardRationale(code, analysis)}
              </p>
              <p
                id={`erp-step4-card-${key}-risk`}
                className="mt-2 text-sm text-[#9a9a94]"
              >
                {cardRisk(analysis)}
              </p>
              <p
                id={`erp-step4-card-${key}-outcome`}
                className="mt-2 text-sm text-[#6a7a8a]"
              >
                {cardOutcome(code, analysis)}
              </p>
              <div
                id={`erp-step4-card-${key}-select`}
                className={`mt-3 text-sm font-semibold ${selected ? "text-[#f0a050]" : "text-[#1e3f6e]"}`}
              >
                {selected ? "Selected" : "Click this card to select"}
              </div>
            </div>
          );
        })}
      </div>

      {analysis?.recommendedStrategy ? (
        <div className="mt-8 w-full rounded-[10px] border border-[#1e3f6e] bg-[#0a1e38] px-[18px] py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a9ac0]">
            Recommended strategy
          </p>
          <p className="mt-2 text-base font-semibold text-white">
            {formatStrategyLabel(analysis.recommendedStrategy)}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-[#8aacc8]">
            Based on your analysis outputs and modeled figures. Choose a card
            above to confirm or override (not legal advice).
          </p>
          <div className="mt-3 inline-flex rounded-md bg-[#f0a050] px-3 py-1 text-xs font-semibold text-white">
            {formatStrategyLabel(analysis.recommendedStrategy)}
          </div>
        </div>
      ) : null}

      {isPreviewMode && onPreviewUnlock && (
        <PreviewPaywallBlock
          onUnlock={onPreviewUnlock}
          busy={previewUnlockBusy}
        />
      )}

      <div className="mt-10 flex flex-wrap gap-4 border-t-[0.5px] border-[#1e3f6e] pt-6">
        <button
          id="erp-step4-back"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onBack}
        >
          Back
        </button>
        <button
          id="erp-step4-next"
          type="button"
          disabled={!strategy || continueLoading}
          className="erp-btn-cta disabled:cursor-not-allowed"
          onClick={() => void handleNext()}
        >
          {continueLoading ? "Generating…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
