"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult, ComparisonResult } from "@/lib/review-json-types";
import { labelForStoredLetterType } from "@/lib/review-letter-labels";
import {
  buildLetterPlaceholderValueMap,
  letterTextToReactNodes,
} from "@/lib/letter-placeholders-display";
import { RegenerateLetterForm } from "./regenerate-letter-form";
import { ReviewDownloadActions } from "./review-download-actions";

type Props = {
  reviewId: string;
  initialLetterText: string | null;
  initialLetterType: string | null;
  insuredName: string | null;
  strategyForLetter: string;
  analysis: AnalysisResult | null;
  analysisRaw: unknown;
  comparison: ComparisonResult | null;
  comparisonRaw: unknown;
  summaryJson: unknown;
  hasSummary: boolean;
  reportTitle: string;
  createdLabel: string;
  safeBaseFileName: string;
  claimType: string;
  aiAnalysisJson: unknown;
  aiComparisonJson: unknown;
};

const PLACEHOLDER_HIGHLIGHT =
  "rounded border border-amber-600/50 bg-amber-400/25 px-0.5 font-mono text-[0.9em] text-amber-100";

function letterBlock(
  text: string | null,
  valueMap: Map<string, string>,
  emptyMessage: string
) {
  if (text?.trim()) {
    return (
      <div className="mt-3 max-h-[min(28rem,70vh)] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-left text-sm leading-relaxed text-slate-200">
        {letterTextToReactNodes(text, valueMap, PLACEHOLDER_HIGHLIGHT)}
      </div>
    );
  }
  return <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>;
}

export function ReviewLetterSection({
  reviewId,
  initialLetterText,
  initialLetterType,
  insuredName,
  strategyForLetter,
  analysis,
  analysisRaw,
  comparison,
  comparisonRaw,
  summaryJson,
  hasSummary,
  reportTitle,
  createdLabel,
  safeBaseFileName,
  claimType,
  aiAnalysisJson,
  aiComparisonJson,
}: Props) {
  /** Letter that was on the review when you opened or switched to this page (from the server). */
  const [letterOnFileText, setLetterOnFileText] = useState<string | null>(
    initialLetterText
  );
  const [letterOnFileType, setLetterOnFileType] = useState<string | null>(
    initialLetterType
  );

  /** Result of the last “Generate new letter” in *this* session; separate from the on-file copy. */
  const [newLetterText, setNewLetterText] = useState<string | null>(null);
  const [newLetterType, setNewLetterType] = useState<string | null>(null);

  // Reset only when navigating to a different review — not when server props
  // refresh with a newly saved letter, so "Letter on file" stays a snapshot
  // for the current page visit.
  useEffect(() => {
    setLetterOnFileText(initialLetterText);
    setLetterOnFileType(initialLetterType);
    setNewLetterText(null);
    setNewLetterType(null);
    // Intentionally omit initialLetter* from deps (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]);

  const onLetterUpdated = useCallback((g: string, m: string) => {
    console.log(
      "[review-letter-section] onLetterUpdated: new letter field only",
      { gLength: g.length, gPreview: g.slice(0, 200), m }
    );
    setNewLetterText(g);
    setNewLetterType(m);
  }, []);

  const valueMap = buildLetterPlaceholderValueMap(
    insuredName,
    aiAnalysisJson,
    summaryJson
  );

  const regenFormLetterTypeKey =
    newLetterType ?? letterOnFileType ?? initialLetterType;

  return (
    <>
      <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-slate-950/50">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
          Letter on file
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          The letter last saved to this review when the page was loaded. It does
          not change when you generate a new letter below.
        </p>
        <p className="mt-3 text-[11px] font-medium text-slate-500">
          Type:{" "}
          <span className="text-slate-200">
            {labelForStoredLetterType(letterOnFileType)}
          </span>
        </p>
        {letterBlock(
          letterOnFileText,
          valueMap,
          "No letter is saved to this review yet. Generate a new letter below; it will appear under “New letter”."
        )}
      </section>

      <section
        className="rounded-3xl border border-emerald-900/50 bg-slate-900/60 p-6 shadow-lg shadow-emerald-950/20"
        aria-label="New letter from regeneration"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">
          New letter
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          A separate result from <strong>Generate new letter</strong> after the
          page was opened. It is also saved to the review (replacing the server
          copy) but is shown here in its own field so the previous text stays
          visible.
        </p>
        <p className="mt-3 text-[11px] font-medium text-slate-500">
          Type:{" "}
          <span className="text-slate-200">
            {newLetterType
              ? labelForStoredLetterType(newLetterType)
              : "— (generate below)"}
          </span>
        </p>
        {letterBlock(
          newLetterText,
          valueMap,
          "No new letter yet. Submit the form below—your new letter will appear here, without replacing “Letter on file” above."
        )}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-slate-950/50">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
          Regenerate letter
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Uses the same letter service as the upload wizard, with the saved
          analysis and comparison. The result appears under{" "}
          <span className="text-slate-200">New letter</span> and is saved to
          this review.
        </p>
        <RegenerateLetterForm
          reviewId={reviewId}
          analysisJson={aiAnalysisJson}
          summaryJsonForPlaceholders={summaryJson}
          comparisonJson={aiComparisonJson}
          strategy={strategyForLetter}
          claimType={claimType}
          initialLetterType={regenFormLetterTypeKey}
          insuredName={insuredName}
          onLetterUpdated={onLetterUpdated}
        />
      </section>

      <ReviewDownloadActions
        reportTitle={reportTitle}
        createdLabel={createdLabel}
        analysis={analysis}
        analysisRaw={analysisRaw}
        comparison={comparison}
        comparisonRaw={comparisonRaw}
        summaryJson={summaryJson}
        hasSummary={hasSummary}
        letterOnFileText={letterOnFileText}
        newLetterText={newLetterText}
        safeBaseFileName={safeBaseFileName}
      />
    </>
  );
}
