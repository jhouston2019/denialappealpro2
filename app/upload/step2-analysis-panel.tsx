"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LockIcon } from "@/components/LockIcon";
import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import {
  buildPreviewFindingIndex,
  PREVIEW_BLUR_CLASS,
  previewBlurForFindingKey,
  previewMoreFindingsCount,
} from "@/lib/preview-blur";
import { wizardFetch } from "@/lib/supabaseClient";
import type {
  AnalysisResult,
  ComparisonResult,
  VersionDiffResult,
} from "@/lib/estimate-json-parse";
import {
  parseAnalysisResult,
  parseComparisonResult,
} from "@/lib/estimate-json-parse";

export type { AnalysisResult, ComparisonResult, VersionDiffResult };
export { parseAnalysisResult, parseComparisonResult };

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function comparisonSummaryLine(c: ComparisonResult): string {
  const carrier = formatMoney(c.totalCarrier);
  const other = formatMoney(c.totalContractor);
  const gap = formatMoney(c.totalDelta);
  if (c.mode === "LINE_COMPARE") {
    return `Contractor estimate provided. Carrier total ${carrier} vs contractor total ${other} — gap of ${gap}.`;
  }
  if (c.mode === "RECON_VS_CARRIER") {
    return `Reconstructed scope vs carrier. Carrier total ${carrier} vs reconstructed total ${other} — gap of ${gap}.`;
  }
  return `Carrier total ${carrier} vs other total ${other} — gap of ${gap}.`;
}

/** UI-only labels; API still uses canonical enum strings. */
const STRATEGY_DISPLAY_LABELS: Record<string, string> = {
  FULL_SUPPLEMENT_DEMAND: "Full Supplement Demand",
  PARTIAL_DISPUTE: "Partial Dispute",
  DEMAND_REINSPECTION: "Demand Re-Inspection",
  INVOKE_APPRAISAL: "Invoke Appraisal",
  OTHER_CUSTOM: "Other / Custom",
};

export function formatStrategyLabel(code: string): string {
  const key = code.trim();
  return STRATEGY_DISPLAY_LABELS[key] ?? key;
}

function riskBadgeClass(_risk: AnalysisResult["riskLevel"]): string {
  return "border-transparent bg-[#f0a050] text-white";
}

type WizardApiFetch = typeof wizardFetch;

type Props = {
  analysis: AnalysisResult | null;
  comparison: ComparisonResult | null;
  onBack: () => void;
  onNext: () => void;
  announce: (message: string) => void;
  /** Unauthenticated /analysis-preview: locked exports, partial narrative blur. */
  isPreviewMode?: boolean;
  /** Defaults to `wizardFetch` for authenticated /upload. */
  wizardApiFetch?: WizardApiFetch;
  onPreviewUnlock?: () => void;
  previewUnlockBusy?: boolean;
};

const STEP2_ACTIONS_KEY = "erp_actions_step2";

const ERP_WHITE_FINDING_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white px-4 py-3";
const ERP_WHITE_ACTION_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e0e0dc] border-l-[3px] border-l-[#f0a050] bg-white px-4 py-3";

export function Step2AnalysisPanel({
  analysis,
  comparison,
  onBack,
  onNext,
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
      const raw = localStorage.getItem(STEP2_ACTIONS_KEY);
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
      STEP2_ACTIONS_KEY,
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
    const root = document.getElementById("erp-step2-print-root");
    if (!root) {
      announce("Download failed: missing print region.");
      return;
    }
    const text = root.innerText;
    const res = await fetcher(netlifyFunctionUrl("generate-pdf"), {
      method: "POST",
      body: JSON.stringify({
        text,
        fileName: "estimate-analysis.pdf",
      }),
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
    a.download = "estimate-analysis.pdf";
    a.click();
    URL.revokeObjectURL(url);
    announce("PDF downloaded.");
  }, [announce, fetcher]);

  const downloadWord = useCallback(async () => {
    const root = document.getElementById("erp-step2-print-root");
    if (!root) {
      announce("Download failed: missing print region.");
      return;
    }
    const text = root.innerText;
    const res = await fetcher(netlifyFunctionUrl("generate-docx"), {
      method: "POST",
      body: JSON.stringify({
        text,
        fileName: "estimate-analysis.docx",
      }),
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
    a.download = "estimate-analysis.docx";
    a.click();
    URL.revokeObjectURL(url);
    announce("Word document downloaded.");
  }, [announce, fetcher]);

  const previewFindingMap = useMemo(
    () => (analysis ? buildPreviewFindingIndex(analysis) : new Map()),
    [analysis]
  );

  const previewMoreFindings = useMemo(
    () => previewMoreFindingsCount(isPreviewMode, previewFindingMap.size),
    [isPreviewMode, previewFindingMap.size]
  );

  const blurFinding = (key: string) =>
    previewBlurForFindingKey(isPreviewMode, previewFindingMap, key);

  const omissionItems = useMemo(() => {
    if (!analysis?.scopeOmissions.length) return ["None identified."];
    return analysis.scopeOmissions;
  }, [analysis]);

  const pricingItems = useMemo(() => {
    if (!analysis?.pricingFlags.length) return ["None identified."];
    return analysis.pricingFlags;
  }, [analysis]);

  const codeItems = useMemo(() => {
    if (!analysis?.codeUpgradeGaps.length) return ["None identified."];
    return analysis.codeUpgradeGaps;
  }, [analysis]);

  const opItems = useMemo(() => {
    if (!analysis?.opFindings.length) return ["None identified."];
    return analysis.opFindings;
  }, [analysis]);

  const procItems = useMemo(() => {
    if (!analysis?.proceduralDefects.length) return ["None identified."];
    return analysis.proceduralDefects;
  }, [analysis]);

  const angleItems = useMemo(() => {
    if (!analysis?.disputeAngles.length) return ["None listed."];
    return analysis.disputeAngles;
  }, [analysis]);

  const actionItems = useMemo(() => {
    if (!analysis?.actionItems.length) return ["None listed."];
    return analysis.actionItems;
  }, [analysis]);

  const docItems = useMemo(() => {
    if (!analysis?.requiredDocuments.length) return ["None listed."];
    return analysis.requiredDocuments;
  }, [analysis]);

  const escalationItems = useMemo(() => {
    if (!analysis?.escalationOptions.length) return ["None listed."];
    return analysis.escalationOptions;
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="text-[#7a8a9a]">
        <p className="text-sm">
          No analysis loaded. Go back to Step 1 and run Continue to generate
          analysis.
        </p>
        <div className="mt-6">
          <button
            id="erp-step2-back"
            type="button"
            className="erp-btn-ghost-panel"
            onClick={onBack}
          >
            Back to Step 1
          </button>
        </div>
      </div>
    );
  }

  const bandMid =
    (analysis.trueLossRange.low + analysis.trueLossRange.high) / 2;
  const gapDollars = bandMid - analysis.carrierAmount;
  const gapDisplay =
    gapDollars > 0 ? formatMoney(gapDollars) : "Within carrier range";
  const gapNumberClass =
    gapDollars > 0
      ? "text-[22px] font-medium text-[#b83030]"
      : "text-[22px] font-medium text-[#9a9a94]";

  const sectionHeading =
    "mb-2 block text-[11px] font-semibold uppercase tracking-[0.07em] text-[#1a2a3a] border-b-[0.5px] border-[#ebebea] pb-2";

  return (
    <div className="text-[#2a3a4a]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-2xl font-bold text-[#1a2a3a]">Step 2 — Analysis</h2>
        <div
          id="erp-step2-badge-risk"
          className={`inline-flex shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${riskBadgeClass(analysis.riskLevel)}`}
        >
          {`Risk level: ${analysis.riskLevel.charAt(0).toUpperCase()}${analysis.riskLevel.slice(1)}`}
        </div>
      </div>
      <p className="mt-2 text-sm text-[#7a8a9a]">
        Structured findings from the carrier estimate.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {isPreviewMode ? (
          <>
            <button
              id="erp-step2-download-analysis-pdf"
              type="button"
              disabled
              title="Unlock your analysis to export"
              className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-4 w-4 shrink-0" />
                Unlock to Download PDF
              </span>
            </button>
            <button
              id="erp-step2-download-analysis-word"
              type="button"
              disabled
              title="Unlock your analysis to export"
              className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-4 w-4 shrink-0" />
                Unlock to Download Word
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              id="erp-step2-download-analysis-pdf"
              type="button"
              className="erp-btn-ghost-panel"
              onClick={() => void downloadPdf()}
            >
              Download PDF
            </button>
            <button
              id="erp-step2-download-analysis-word"
              type="button"
              className="erp-btn-ghost-panel"
              onClick={() => void downloadWord()}
            >
              Download Word
            </button>
          </>
        )}
      </div>

      <div
        id="erp-step2-print-root"
        className="mt-8 border-t-[0.5px] border-[#ebebea] pt-8 text-[#2a3a4a]"
      >
        <p className="text-sm font-semibold text-[#7a8a9a]">
          Estimate Review Pro — Analysis Summary
        </p>
        <p className="mt-1 text-sm text-[#7a8a9a]">
          Risk level:{" "}
          {`${analysis.riskLevel.charAt(0).toUpperCase()}${analysis.riskLevel.slice(1)}`}
        </p>

        {comparison && (
          <div
            className={`mt-4 border-b border-[#ebebea] pb-3 text-sm text-[#2a3a4a] ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}
          >
            <div className={ERP_WHITE_FINDING_PANEL}>
              <h3 className={sectionHeading}>Comparison</h3>
              <p className="py-2 text-sm text-[#7a8a9a]">
                {comparisonSummaryLine(comparison)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <section id="erp-step2-card-gap" className="flex flex-col gap-3">
              <h3 className={sectionHeading}>Carrier vs true loss range</h3>
              <div className="rounded-r-[10px] border-[0.5px] border-[#e0e0dc] border-l-[3px] border-l-[#f0a050] bg-white py-3 pl-4 pr-3">
                <div className="space-y-4">
                  <div>
                    <p className="text-[22px] font-medium text-[#1a2a3a]">
                      {formatMoney(analysis.carrierAmount)}
                    </p>
                    <p className="text-xs text-[#7a8a9a]">Carrier amount</p>
                  </div>
                  <div className={isPreviewMode ? PREVIEW_BLUR_CLASS : undefined}>
                    <p className="text-[22px] font-medium text-[#1a2a3a]">
                      {formatMoney(analysis.trueLossRange.low)} –{" "}
                      {formatMoney(analysis.trueLossRange.high)}
                    </p>
                    <p className="text-xs text-[#7a8a9a]">True loss range</p>
                  </div>
                </div>
              </div>
              <div
                className={`rounded-r-[10px] border-[0.5px] border-[#e0e0dc] border-l-[3px] border-l-[#b83030] bg-white py-3 pl-4 pr-3 ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}
              >
                <div>
                  <p className={gapNumberClass}>{gapDisplay}</p>
                  <p className="text-xs text-[#7a8a9a]">Estimated gap</p>
                </div>
              </div>
            </section>

            <section id="erp-step2-card-procedural" className="text-sm">
              <h3 className={sectionHeading}>Procedural defects</h3>
              <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
                {analysis.proceduralDefects.length === 0 ? (
                  <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {procItems.map((t, i) => (
                      <li
                        key={i}
                        id={`erp-step2-proc-${i + 1}`}
                        className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                          `pc:${i}`
                        )}`}
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
            </section>
          </div>

          <div className="flex flex-col gap-0">
            <div className="border-b border-[#ebebea] pb-3">
              <section id="erp-step2-card-scope-omissions">
                <h3 className={sectionHeading}>Scope omissions</h3>
                <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
                  {!analysis.scopeOmissions.length ? (
                    <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {omissionItems.map((t, i) => (
                        <li
                          key={i}
                          id={`erp-step2-omission-${i + 1}`}
                          className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                            `om:${i}`
                          )}`}
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
              </section>
            </div>

            <div className="border-b border-[#ebebea] pb-3">
              <section id="erp-step2-card-pricing">
                <h3 className={sectionHeading}>Pricing flags</h3>
                <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
                  {!analysis.pricingFlags.length ? (
                    <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {pricingItems.map((t, i) => (
                        <li
                          key={i}
                          id={`erp-step2-pricing-${i + 1}`}
                          className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                            `pr:${i}`
                          )}`}
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
              </section>
            </div>

            <div className="border-b border-[#ebebea] pb-3">
              <section id="erp-step2-card-code-upgrade">
                <h3 className={sectionHeading}>Code / upgrade gaps</h3>
                <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
                  {!analysis.codeUpgradeGaps.length ? (
                    <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {codeItems.map((t, i) => (
                        <li
                          key={i}
                          id={`erp-step2-code-${i + 1}`}
                          className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                            `cd:${i}`
                          )}`}
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

            <div className="border-b border-[#ebebea] pb-3 last:border-0 last:pb-0">
              <section id="erp-step2-card-op">
                <h3 className={sectionHeading}>OP / supplement findings</h3>
                <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
                  {!analysis.opFindings.length ? (
                    <p className="text-sm italic text-[#7a8a9a]">None identified.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {opItems.map((t, i) => (
                        <li
                          key={i}
                          id={`erp-step2-op-${i + 1}`}
                          className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                            `op:${i}`
                          )}`}
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
          </div>
        </div>

        <div className="mt-6 space-y-0">
          <section
            id="erp-step2-section-dispute-angles"
            className="border-b border-[#ebebea] pb-3"
          >
            <h3 className={sectionHeading}>Dispute angles</h3>
            <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
              {!analysis.disputeAngles.length ? (
                <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {angleItems.map((t, i) => (
                    <li
                      key={i}
                      id={`erp-step2-angle-${i + 1}`}
                      className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                        `an:${i}`
                      )}`}
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
          </section>

          <section
            id="erp-step2-section-action-items"
            className="border-b border-[#ebebea] pb-3"
          >
            <h3 className={sectionHeading}>Action items</h3>
            <div className={`${ERP_WHITE_ACTION_PANEL} mt-1`}>
              {!analysis.actionItems.length ? (
                <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm text-[#2a3a4a]">
                  {actionItems.map((t, i) => (
                    <li
                      key={i}
                      id={`erp-step2-action-${i + 1}`}
                      className={`flex gap-2 ${blurFinding(`ac:${i}`)}`}
                    >
                      <input
                        type="checkbox"
                        className="erp-action-check"
                        checked={checkedActions.has(i)}
                        onChange={() => toggleActionItem(i)}
                        aria-labelledby={`erp-step2-action-label-${i + 1}`}
                      />
                      <span id={`erp-step2-action-label-${i + 1}`}>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section
            id="erp-step2-section-required-docs"
            className="border-b border-[#ebebea] pb-3"
          >
            <h3 className={sectionHeading}>Required documents</h3>
            <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
              {!analysis.requiredDocuments.length ? (
                <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {docItems.map((t, i) => (
                    <li
                      key={i}
                      id={`erp-step2-doc-${i + 1}`}
                      className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                        `rq:${i}`
                      )}`}
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

          <section
            id="erp-step2-section-escalation"
            className="border-b border-[#ebebea] pb-3"
          >
            <h3 className={sectionHeading}>Escalation options</h3>
            <div className={`${ERP_WHITE_FINDING_PANEL} mt-1`}>
              {!analysis.escalationOptions.length ? (
                <p className="text-sm italic text-[#7a8a9a]">None listed.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {escalationItems.map((t, i) => (
                    <li
                      key={i}
                      id={`erp-step2-escalation-${i + 1}`}
                      className={`flex gap-2 text-sm text-[#2a3a4a] ${blurFinding(
                        `es:${i}`
                      )}`}
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

          {isPreviewMode && previewMoreFindings > 0 ? (
            <p
              className="pb-2 text-sm text-[#7a8a9a]"
              id="erp-step2-preview-more-findings"
            >
              {previewMoreFindings} more findings in your full analysis
            </p>
          ) : null}

          <section
            className={`pb-2 pt-2 ${isPreviewMode ? PREVIEW_BLUR_CLASS : ""}`}
          >
            <div className="w-full rounded-[10px] border border-[#1e3f6e] bg-[#0a1e38] px-[18px] py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a9ac0]">
                Recommended strategy
              </p>
              <p className="mt-2 text-base font-semibold text-white">
                {analysis.recommendedStrategy
                  ? formatStrategyLabel(analysis.recommendedStrategy)
                  : "—"}
              </p>
              <p className="mt-2 text-[13px] leading-snug text-[#8aacc8]">
                {analysis.availableStrategies.length > 0
                  ? `Also consider: ${analysis.availableStrategies.map(formatStrategyLabel).join(", ")}.`
                  : "No additional strategies listed."}
              </p>
              {analysis.recommendedStrategy ? (
                <div className="mt-3 inline-flex rounded-md bg-[#f0a050] px-3 py-1 text-xs font-semibold text-white">
                  {formatStrategyLabel(analysis.recommendedStrategy)}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {isPreviewMode && onPreviewUnlock ? (
        <PreviewPaywallBlock
          onUnlock={onPreviewUnlock}
          busy={previewUnlockBusy}
        />
      ) : null}

      <div className="mt-10 flex flex-wrap gap-4 border-t-[0.5px] border-[#1e3f6e] pt-6">
        <button
          id="erp-step2-back"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onBack}
        >
          Back
        </button>
        <button
          id="erp-step2-next"
          type="button"
          className="erp-btn-cta"
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
