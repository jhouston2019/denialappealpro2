"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LockIcon } from "@/components/LockIcon";
import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import {
  buildPreviewFindingIndex,
  PREVIEW_BLUR_CLASS,
  previewBlurForFindingKey,
} from "@/lib/preview-blur";
import { wizardFetch } from "@/lib/supabaseClient";
import {
  formatStrategyLabel,
  type AnalysisResult,
  type ComparisonResult,
} from "./step2-analysis-panel";

type ClaimMeta = {
  insuredName: string;
  carrierName: string;
  claimType: string;
  state: string;
  policyNumber: string;
  claimNumber: string;
  dateOfLoss: string;
  adjusterName: string;
  responseDeadline: string;
};

type WizardApiFetch = typeof wizardFetch;

type Props = {
  analysis: AnalysisResult | null;
  comparison: ComparisonResult | null;
  strategy: string | null;
  claimMeta: ClaimMeta;
  onBack: () => void;
  onGoToLetter: () => void;
  onStartOver: () => void;
  announce: (message: string) => void;
  isPreviewMode?: boolean;
  wizardApiFetch?: WizardApiFetch;
  onPreviewUnlock?: () => void | Promise<void>;
  previewUnlockBusy?: boolean;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

const SUMMARY_DIVIDER = "---------------------------------------";

/**
 * True loss band + estimated gap for summary export and on-screen gap card.
 * midpoint = (trueLossRange.low + trueLossRange.high) / 2
 * gap = midpoint − carrierAmount (does not use disputedAmount).
 * If gap <= 0, the label is "Within carrier range" instead of a dollar amount.
 */
export function getSummaryIdentifiedGap(
  analysis: AnalysisResult,
  _claimMeta: ClaimMeta
): {
  displayLow: number;
  displayHigh: number;
  estimatedGap: number;
  estimatedGapLabel: string;
} {
  const c = Number(analysis.carrierAmount);
  const displayLow = Number(analysis.trueLossRange.low);
  const displayHigh = Number(analysis.trueLossRange.high);
  const mid = (displayLow + displayHigh) / 2;
  const estimatedGap = mid - c;
  const estimatedGapLabel =
    estimatedGap > 0 ? formatMoney(estimatedGap) : "Within carrier range";
  return {
    displayLow,
    displayHigh,
    estimatedGap,
    estimatedGapLabel,
  };
}

function titleCaseRisk(level: string): string {
  const x = String(level || "").toLowerCase();
  if (x === "low") return "Low";
  if (x === "high") return "High";
  if (x === "moderate" || x === "medium") return "Moderate";
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : "—";
}

/** Plain-text summary for PDF/DOCX (Times Roman in generator; structure matters). */
export function buildSummaryText(
  analysis: AnalysisResult | null,
  comparison: ComparisonResult | null,
  claimMeta: ClaimMeta,
  strategy: string | null
): string {
  const claimLines: string[] = [
    "CLAIM IDENTIFICATION",
    alignClaimLine("Policy Number:", claimMeta.policyNumber || "—"),
    alignClaimLine("Claim Number:", claimMeta.claimNumber || "—"),
    alignClaimLine("Insured Name:", claimMeta.insuredName?.trim() || "—"),
    alignClaimLine("Date of Loss:", claimMeta.dateOfLoss || "—"),
    alignClaimLine("Adjuster Name:", claimMeta.adjusterName || "—"),
    alignClaimLine("Carrier Name:", claimMeta.carrierName?.trim() || "—"),
  ];

  const gapSection: string[] = ["IDENTIFIED GAP"];
  if (analysis) {
    const { carrierAmount, riskLevel } = analysis;
    const { displayLow, displayHigh, estimatedGapLabel } =
      getSummaryIdentifiedGap(analysis, claimMeta);
    gapSection.push(
      alignClaimLine("Carrier Amount:", formatMoney(carrierAmount)),
      alignClaimLine(
        "True Loss Range:",
        `${formatMoney(displayLow)} – ${formatMoney(displayHigh)}`
      ),
      alignClaimLine("Estimated Gap:", estimatedGapLabel),
      alignClaimLine("Risk Level:", titleCaseRisk(riskLevel))
    );
  } else {
    gapSection.push(
      alignClaimLine("Carrier Amount:", "—"),
      alignClaimLine("True Loss Range:", "—"),
      alignClaimLine("Estimated Gap:", "—"),
      alignClaimLine("Risk Level:", "—")
    );
  }

  const bullets = (items: string[], emptyLine: string) =>
    items.length > 0
      ? items.map((t) => `  • ${t}`).join("\n")
      : `  • ${emptyLine}`;

  const scopeItems =
    analysis?.scopeOmissions?.length ? analysis.scopeOmissions : [];
  const pricingItems =
    analysis?.pricingFlags?.length ? analysis.pricingFlags : [];
  const codeItems =
    analysis?.codeUpgradeGaps?.length ? analysis.codeUpgradeGaps : [];
  const opItems = analysis?.opFindings?.length ? analysis.opFindings : [];
  const procItems =
    analysis?.proceduralDefects?.length ? analysis.proceduralDefects : [];
  const angleItems =
    analysis?.disputeAngles?.length ? analysis.disputeAngles : [];
  const actionItems =
    analysis?.actionItems?.length ? analysis.actionItems : [];
  const docItems =
    analysis?.requiredDocuments?.length ? analysis.requiredDocuments : [];
  const escItems =
    analysis?.escalationOptions?.length ? analysis.escalationOptions : [];

  const strategyLabel =
    strategy && strategy.trim()
      ? formatStrategyLabel(strategy)
      : analysis
        ? formatStrategyLabel(analysis.recommendedStrategy)
        : "—";

  const parts: string[] = [
    "ESTIMATE REVIEW PRO — FINDINGS SUMMARY",
    "=======================================",
    "",
    ...claimLines,
    "",
    SUMMARY_DIVIDER,
    "",
    ...gapSection,
    "",
    SUMMARY_DIVIDER,
    "",
    "SCOPE OMISSIONS",
    bullets(scopeItems, "None identified."),
    "",
    "PRICING SUPPRESSION FLAGS",
    bullets(pricingItems, "None identified."),
    "",
    "CODE UPGRADE GAPS",
    bullets(codeItems, "None identified."),
    "",
    "O&P FINDINGS",
    bullets(opItems, "None identified."),
    "",
    "PROCEDURAL DEFECTS",
    bullets(procItems, "None identified."),
    "",
    SUMMARY_DIVIDER,
    "",
  ];

  if (comparison) {
    parts.push(
      "COMPARISON SUMMARY",
      alignClaimLine("Total Carrier:", formatMoney(comparison.totalCarrier)),
      alignClaimLine(
        "Total Contractor/Recon:",
        formatMoney(comparison.totalContractor)
      ),
      alignClaimLine("Total Gap:", formatMoney(comparison.totalDelta)),
      "",
      SUMMARY_DIVIDER,
      ""
    );
  }

  parts.push(
    "SELECTED STRATEGY",
    strategyLabel,
    "",
    "DISPUTE ANGLES",
    bullets(angleItems, "None identified."),
    "",
    "ACTION ITEMS",
    bullets(actionItems, "None identified."),
    "",
    "REQUIRED DOCUMENTS",
    bullets(docItems, "None identified."),
    "",
    "ESCALATION OPTIONS",
    bullets(escItems, "None identified."),
    "",
    SUMMARY_DIVIDER,
    "",
    "This summary was generated by Estimate Review Pro.",
    "Findings are based on structured analysis of submitted documents.",
    "This is not legal advice."
  );

  return parts.join("\n");
}

function alignClaimLine(label: string, value: string): string {
  const w = 22;
  const base = label.length <= w ? label.padEnd(w) : `${label} `;
  return `${base}${value}`;
}

const STEP5_ACTIONS_KEY = "erp_actions_step5";

const STEP5_WHITE_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white px-4 py-3";
const STEP5_METRIC_AMBER =
  "rounded-none rounded-r-[10px] border-[0.5px] border-[#e0e0dc] border-l-[3px] border-l-[#f0a050] bg-white py-3 pl-4 pr-3";
const STEP5_METRIC_RED =
  "rounded-none rounded-r-[10px] border-[0.5px] border-[#e0e0dc] border-l-[3px] border-l-[#b83030] bg-white py-3 pl-4 pr-3";
function strategyRationaleFromAnalysis(
  analysis: AnalysisResult | null,
  strategy: string | null
): string {
  if (!analysis) return "—";
  const { carrierAmount, trueLossRange, riskLevel } = analysis;
  const { low, high } = trueLossRange;
  const mid = (low + high) / 2;
  const gap = mid - carrierAmount;
  const gapNote =
    Number.isFinite(gap) && Math.abs(gap) > 0.01
      ? `Modeled band midpoint ${formatMoney(mid)} vs carrier total ${formatMoney(carrierAmount)} (difference about ${formatMoney(Math.abs(gap))}). `
      : "";
  const strat =
    strategy && strategy.trim()
      ? formatStrategyLabel(strategy)
      : formatStrategyLabel(analysis.recommendedStrategy);
  return `${gapNote}Risk level from analysis: ${riskLevel}. Selected strategy: ${strat}. Findings below are taken only from the structured analysis output (not legal advice).`;
}

export function Step5SummaryPanel({
  analysis,
  comparison,
  strategy,
  claimMeta,
  onBack,
  onGoToLetter,
  onStartOver,
  announce,
  isPreviewMode = false,
  wizardApiFetch,
  onPreviewUnlock,
  previewUnlockBusy = false,
}: Props) {
  const fetcher = wizardApiFetch ?? wizardFetch;
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!analysis?.actionItems?.length) {
      setCheckedActions(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(STEP5_ACTIONS_KEY);
      if (!raw) {
        setCheckedActions(new Set());
        return;
      }
      const arr = JSON.parse(raw) as number[];
      const len = analysis.actionItems.length;
      setCheckedActions(
        new Set(arr.filter((i) => Number.isInteger(i) && i >= 0 && i < len))
      );
    } catch {
      setCheckedActions(new Set());
    }
  }, [analysis]);

  useEffect(() => {
    if (!analysis?.actionItems?.length) return;
    localStorage.setItem(
      STEP5_ACTIONS_KEY,
      JSON.stringify([...checkedActions].sort((a, b) => a - b))
    );
  }, [checkedActions, analysis]);

  const toggleActionItem = useCallback((index: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const downloadPdf = useCallback(async () => {
    const text = buildSummaryText(analysis, comparison, claimMeta, strategy);
    const res = await fetcher(netlifyFunctionUrl("generate-pdf"), {
      method: "POST",
      body: JSON.stringify({ text, fileName: "wizard-summary.pdf" }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("application/json")) {
      await res.text().catch(() => "");
      announce("PDF download failed. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wizard-summary.pdf";
    a.click();
    URL.revokeObjectURL(url);
    announce("Summary PDF downloaded.");
  }, [analysis, comparison, claimMeta, strategy, announce, fetcher]);

  const downloadWord = useCallback(async () => {
    const root = document.getElementById("erp-step5-print-root");
    if (!root) {
      announce("Print region missing.");
      return;
    }
    const text = root.innerText;
    const res = await fetcher(netlifyFunctionUrl("generate-docx"), {
      method: "POST",
      body: JSON.stringify({ text, fileName: "wizard-summary.docx" }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("application/json")) {
      await res.text().catch(() => "");
      announce("Word download failed. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wizard-summary.docx";
    a.click();
    URL.revokeObjectURL(url);
    announce("Summary Word document downloaded.");
  }, [analysis, announce, claimMeta, comparison, strategy, fetcher]);

  const carrierNameDisplay = claimMeta.carrierName?.trim() || "—";

  const a = analysis;
  const omissions = a?.scopeOmissions?.length
    ? a.scopeOmissions
    : ["None listed."];
  const pricing = a?.pricingFlags?.length ? a.pricingFlags : ["None listed."];
  const codes = a?.codeUpgradeGaps?.length
    ? a.codeUpgradeGaps
    : ["None listed."];
  const ops = a?.opFindings?.length ? a.opFindings : ["None listed."];
  const procs = a?.proceduralDefects?.length
    ? a.proceduralDefects
    : ["None listed."];
  const actions = a?.actionItems?.length ? a.actionItems : ["None listed."];
  const docs = a?.requiredDocuments?.length
    ? a.requiredDocuments
    : ["None listed."];
  const esc = a?.escalationOptions?.length
    ? a.escalationOptions
    : ["None listed."];

  const previewFindingMap = useMemo(
    () => (a ? buildPreviewFindingIndex(a) : new Map<string, number>()),
    [a]
  );
  const blurFinding = (key: string) =>
    previewBlurForFindingKey(isPreviewMode, previewFindingMap, key);

  const sectionHeading =
    "mb-2 block text-[11px] font-semibold uppercase tracking-[0.07em] text-[#1a2a3a] border-b-[0.5px] border-[#ebebea] pb-2";

  const gm = a ? getSummaryIdentifiedGap(a, claimMeta) : null;
  const gapValueClass =
    !gm
      ? "text-[22px] font-medium text-[#7a8a9a]"
      : gm.estimatedGap > 0
        ? "text-[22px] font-medium text-[#b83030]"
        : "text-[22px] font-medium text-[#7a8a9a]";

  return (
    <div className="text-[#2a3a4a]">
      <h2
        id="erp-step5-heading"
        className="text-2xl font-bold text-[#1a2a3a]"
      >
        Step 5 — Summary
      </h2>
      <p className="mt-2 text-sm text-[#7a8a9a]">
        Complete findings summary. Export as PDF or Word.
      </p>

      <div
        id="erp-step5-print-root"
        className="mt-6 space-y-6 text-sm text-[#2a3a4a]"
      >
        <section
          id="erp-step5-claim-block"
          className="rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#7a8a9a]">Insured name</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {claimMeta.insuredName?.trim() || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7a8a9a]">Policy number</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {claimMeta.policyNumber || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7a8a9a]">Claim number</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {claimMeta.claimNumber || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7a8a9a]">Date of loss</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {claimMeta.dateOfLoss || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7a8a9a]">Adjuster name</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {claimMeta.adjusterName || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7a8a9a]">Carrier name</p>
              <p className="text-sm font-medium text-[#1a2a3a]">
                {carrierNameDisplay}
              </p>
            </div>
          </div>
        </section>

        <section id="erp-step5-gap-card" className="flex flex-col gap-3">
          <h3 className={sectionHeading}>Identified gap</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={STEP5_METRIC_AMBER}>
              <p className="text-[22px] font-medium text-[#1a2a3a]">
                {a ? formatMoney(a.carrierAmount) : "—"}
              </p>
              <p className="mt-1 text-xs text-[#7a8a9a]">Carrier amount</p>
            </div>
            <div className={`${STEP5_METRIC_AMBER} ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}>
              <p className="text-[22px] font-medium text-[#1a2a3a]">
                {gm
                  ? `${formatMoney(gm.displayLow)} – ${formatMoney(gm.displayHigh)}`
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-[#7a8a9a]">True loss range</p>
            </div>
          </div>
          <div className={`${STEP5_METRIC_RED} ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}>
            <div>
              <p className={gapValueClass}>{gm ? gm.estimatedGapLabel : "—"}</p>
              <p className="mt-1 text-xs text-[#9a9a94]">Estimated gap</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-0">
            <div className="border-b border-[#ebebea] pb-3">
              <h3 className={sectionHeading}>Scope omissions</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.scopeOmissions?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul
                    id="erp-step5-scope-list"
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    {omissions.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step5-scope-${i + 1}`}
                        className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`om:${i}`)}`}
                      >
                        <span
                          className="erp-find-dot erp-find-dot-amber"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-b border-[#ebebea] pb-3">
              <h3 className={sectionHeading}>Pricing suppression flags</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.pricingFlags?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul
                    id="erp-step5-pricing-list"
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    {pricing.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step5-pricing-${i + 1}`}
                        className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`pr:${i}`)}`}
                      >
                        <span
                          className="erp-find-dot erp-find-dot-amber"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-b border-[#ebebea] pb-3">
              <h3 className={sectionHeading}>Code upgrade gaps</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.codeUpgradeGaps?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul
                    id="erp-step5-code-list"
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    {codes.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step5-code-${i + 1}`}
                        className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`cd:${i}`)}`}
                      >
                        <span
                          className="erp-find-dot erp-find-dot-navy"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-b border-[#ebebea] pb-3">
              <h3 className={sectionHeading}>O&amp;P findings</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.opFindings?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul
                    id="erp-step5-op-list"
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    {ops.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step5-op-${i + 1}`}
                        className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`op:${i}`)}`}
                      >
                        <span
                          className="erp-find-dot erp-find-dot-navy"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-b border-[#ebebea] pb-3 last:border-0 last:pb-0">
              <h3 className={sectionHeading}>Procedural defects</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.proceduralDefects?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul
                    id="erp-step5-procedural-list"
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    {procs.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step5-proc-${i + 1}`}
                        className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`pc:${i}`)}`}
                      >
                        <span
                          className="erp-find-dot erp-find-dot-red"
                          aria-hidden
                        />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0">
            {comparison && (
              <section
                id="erp-step5-comparison-block"
                className="mb-4 rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white p-4"
              >
                <h3 className={sectionHeading}>Comparison totals</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white py-2 pl-3 pr-2">
                    <p className="text-xl font-medium text-[#1a2a3a]">
                      {formatMoney(comparison.totalCarrier)}
                    </p>
                    <p className="mt-1 text-xs text-[#7a8a9a]">Total carrier</p>
                  </div>
                  <div className={`${STEP5_METRIC_AMBER} ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}>
                    <p className="text-xl font-medium text-[#1a2a3a]">
                      {formatMoney(comparison.totalContractor)}
                    </p>
                    <p className="mt-1 text-xs text-[#7a8a9a]">
                      Total contractor / recon
                    </p>
                  </div>
                  <div className={`${STEP5_METRIC_RED} ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}>
                    <p className="text-xl font-medium text-[#b83030]">
                      {formatMoney(comparison.totalDelta)}
                    </p>
                    <p className="mt-1 text-xs text-[#9a9a94]">Total delta</p>
                  </div>
                </div>
              </section>
            )}

            <section
              id="erp-step5-strategy-block"
              className="border-b border-[#ebebea] pb-3"
            >
              <h3 className={sectionHeading}>Selected strategy</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                <p className="py-2 text-sm font-medium text-[#1a2a3a]">
                  {strategy ? formatStrategyLabel(strategy) : "—"}
                </p>
                <p className="text-sm text-[#7a8a9a]">
                  {strategyRationaleFromAnalysis(analysis, strategy)}
                </p>
              </div>
            </section>

            <section className="pb-2 pt-2">
              <h3 className={sectionHeading}>Action items</h3>
              <div className={`${STEP5_WHITE_PANEL} mt-1`}>
                {!a?.actionItems?.length ? (
                  <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
                ) : (
                  <ul
                    id="erp-step5-action-list"
                    className="flex flex-col gap-1.5 text-[#2a3a4a]"
                  >
                    {actions.map((t, i) => (
                      <li key={i} id={`erp-step5-action-${i + 1}`} className="flex gap-2">
                        <input
                          type="checkbox"
                          className="erp-action-check"
                          checked={checkedActions.has(i)}
                          onChange={() => toggleActionItem(i)}
                          aria-labelledby={`erp-step5-action-label-${i + 1}`}
                        />
                        <span
                          id={`erp-step5-action-label-${i + 1}`}
                          className={`text-sm ${blurFinding(`ac:${i}`)}`}
                        >
                          {t}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="border-b border-[#ebebea] pb-3">
          <h3 className={sectionHeading}>Required documents</h3>
          <div className={`${STEP5_WHITE_PANEL} mt-1`}>
            {!a?.requiredDocuments?.length ? (
              <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
            ) : (
              <ul
                id="erp-step5-docs-list"
                className="flex flex-col gap-1.5 text-sm"
              >
                {docs.map((t, i) => (
                  <li
                    key={i}
                    id={`erp-step5-doc-${i + 1}`}
                    className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`rq:${i}`)}`}
                  >
                    <span
                      className="erp-find-dot erp-find-dot-navy"
                      aria-hidden
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="pb-2">
          <h3 className={sectionHeading}>Escalation options</h3>
          <div className={`${STEP5_WHITE_PANEL} mt-1`}>
            {!a?.escalationOptions?.length ? (
              <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
            ) : (
              <ul
                id="erp-step5-escalation-list"
                className="flex flex-col gap-1.5 text-sm"
              >
                {esc.map((t, i) => (
                  <li
                    key={i}
                    className={`flex gap-2 text-[#2a3a4a] ${blurFinding(`es:${i}`)}`}
                  >
                    <span
                      className="erp-find-dot erp-find-dot-navy"
                      aria-hidden
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t-[0.5px] border-[#1e3f6e] pt-6">
        {isPreviewMode ? (
          <>
            <button
              type="button"
              disabled
              title="Unlock your analysis to export"
              className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-4 w-4" />
                Unlock to Download PDF
              </span>
            </button>
            <button
              type="button"
              disabled
              title="Unlock your analysis to export"
              className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-4 w-4" />
                Unlock to Download Word
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              id="erp-step5-download-pdf"
              type="button"
              className="erp-btn-ghost-panel"
              onClick={() => void downloadPdf()}
            >
              Download PDF
            </button>
            <button
              id="erp-step5-download-word"
              type="button"
              className="erp-btn-ghost-panel"
              onClick={() => void downloadWord()}
            >
              Download Word
            </button>
          </>
        )}
      </div>

      {isPreviewMode && onPreviewUnlock && (
        <PreviewPaywallBlock
          onUnlock={onPreviewUnlock}
          busy={previewUnlockBusy}
        />
      )}

      <div className="mt-10 flex flex-wrap gap-4 border-t-[0.5px] border-[#1e3f6e] pt-6">
        <button
          id="erp-step5-back"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onBack}
        >
          Back
        </button>
        <button
          id="erp-step5-go-to-letter"
          type="button"
          className="erp-btn-cta"
          onClick={onGoToLetter}
        >
          Generate Letter (Optional)
        </button>
        <button
          id="erp-step5-start-over"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onStartOver}
        >
          Start over
        </button>
      </div>
    </div>
  );
}
