"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ReviewDownloadActions } from "@/app/dashboard/review/[id]/review-download-actions";
import {
  parseAnalysisResult,
  parseComparisonResult,
} from "@/lib/estimate-json-parse";
import { saveWizardReview } from "@/lib/save-wizard-review";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  deliverablesFromSnapshot,
  deliverablesTitle,
  safeDeliverablesFileName,
  type WizardDeliverables,
} from "@/lib/wizard-deliverables";
import {
  DELIVERABLES_REVIEW_ID_KEY,
  tryParseWizardSnapshot,
  WIZARD_STATE_STORAGE_KEY,
} from "@/lib/wizard-snapshot";
import { formatStrategyLabel } from "@/app/upload/step2-analysis-panel";
import { getSummaryIdentifiedGap } from "@/app/upload/step5-summary-panel";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function riskClass(level: string): string {
  const l = level.toLowerCase();
  if (l === "high") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (l === "low")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return "border-amber-500/40 bg-amber-500/10 text-amber-200";
}

function SummaryReadable({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <p className="text-sm text-slate-500">No summary generated yet.</p>;
  }
  if (typeof data === "string") {
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
        {data}
      </div>
    );
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return (
      <pre className="max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return (
    <pre className="text-sm text-slate-200">{JSON.stringify(data, null, 2)}</pre>
  );
}

type SectionProps = {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function DeliverableSection({
  id,
  title,
  defaultOpen = false,
  children,
}: SectionProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg shadow-slate-950/50"
    >
      <summary className="cursor-pointer list-none px-6 py-4 marker:content-none">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
            {title}
          </h2>
          <span className="text-slate-500 transition group-open:rotate-180">
            ▾
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-800 px-6 pb-6 pt-4">{children}</div>
    </details>
  );
}

function DeliverablesBody({
  d,
  reviewId,
  createdLabel,
}: {
  d: WizardDeliverables;
  reviewId: string | null;
  createdLabel: string;
}) {
  const title = deliverablesTitle(d);
  const safeBase = safeDeliverablesFileName(title);
  const hasLetterType = Boolean(d.letterType?.trim());
  const hasLetter = Boolean(d.letterRaw?.trim());

  const summaryForExport = d.summary;
  const hasSummary = summaryForExport != null;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/upload?step=2"
          className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Open in wizard
        </Link>
        {hasLetterType && !hasLetter ? (
          <Link
            href="/upload?step=6"
            className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2563EB]/30 transition hover:bg-[#1E40AF]"
          >
            Generate letter
          </Link>
        ) : null}
        {reviewId ? (
          <Link
            href={`/dashboard/review/${reviewId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:border-blue-500/50 hover:text-blue-200"
          >
            Saved review detail
          </Link>
        ) : null}
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-lg bg-[#f0a050] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Buy another review
        </Link>
      </div>

      <ReviewDownloadActions
        reportTitle={title}
        createdLabel={createdLabel}
        analysis={d.analysis}
        analysisRaw={d.analysis}
        comparison={d.comparison}
        comparisonRaw={d.comparison}
        summaryJson={summaryForExport}
        hasSummary={hasSummary}
        letterOnFileText={null}
        newLetterText={d.letterRaw}
        safeBaseFileName={safeBase}
      />

      <div className="flex flex-col gap-4">
        {d.analysis ? (
          <DeliverableSection id="analysis" title="Analysis" defaultOpen>
            <div className="space-y-5 text-sm text-slate-200">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Risk level
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${riskClass(
                    d.analysis.riskLevel
                  )}`}
                >
                  {d.analysis.riskLevel}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  True loss range
                </p>
                <p className="mt-1">
                  {formatMoney(d.analysis.trueLossRange.low)} –{" "}
                  {formatMoney(d.analysis.trueLossRange.high)}
                </p>
              </div>
              <FindingList
                label="Scope omissions"
                items={d.analysis.scopeOmissions}
              />
              <FindingList
                label="Pricing flags"
                items={d.analysis.pricingFlags}
              />
              <FindingList
                label="Code upgrade gaps"
                items={d.analysis.codeUpgradeGaps}
              />
              <FindingList
                label="O&amp;P findings"
                items={d.analysis.opFindings}
              />
              <FindingList
                label="Procedural defects"
                items={d.analysis.proceduralDefects}
              />
              <FindingList
                label="Dispute angles"
                items={d.analysis.disputeAngles}
              />
              <FindingList
                label="Action items"
                items={d.analysis.actionItems}
              />
            </div>
          </DeliverableSection>
        ) : null}

        {d.comparison ? (
          <DeliverableSection id="comparison" title="Comparison">
            <div className="space-y-4 text-sm text-slate-200">
              <p className="text-xs text-slate-400">Mode: {d.comparison.mode}</p>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <Stat label="Carrier total" value={d.comparison.totalCarrier} />
                <Stat
                  label="Other total"
                  value={d.comparison.totalContractor}
                />
                <Stat label="Delta" value={d.comparison.totalDelta} />
              </div>
              {d.comparison.lineItems.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Trade</th>
                        <th className="px-3 py-2">Carrier</th>
                        <th className="px-3 py-2">Amt</th>
                        <th className="px-3 py-2">Other</th>
                        <th className="px-3 py-2">Amt</th>
                        <th className="px-3 py-2">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.comparison.lineItems.slice(0, 20).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-800/80 text-slate-200"
                        >
                          <td className="px-3 py-2">{row.trade}</td>
                          <td className="px-3 py-2">{row.carrierItem}</td>
                          <td className="px-3 py-2">
                            {formatMoney(row.carrierAmount)}
                          </td>
                          <td className="px-3 py-2">{row.contractorItem}</td>
                          <td className="px-3 py-2">
                            {formatMoney(row.contractorAmount)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {d.comparison.lineItems.length > 20 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-500">
                      Showing 20 of {d.comparison.lineItems.length} rows — open
                      the wizard for the full table.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DeliverableSection>
        ) : null}

        {d.strategy ? (
          <DeliverableSection id="strategy" title="Strategy">
            <p className="text-sm text-slate-200">
              Selected strategy:{" "}
              <span className="font-semibold text-slate-50">
                {formatStrategyLabel(d.strategy)}
              </span>
            </p>
            {d.analysis?.recommendedStrategy &&
            d.analysis.recommendedStrategy !== d.strategy ? (
              <p className="mt-2 text-xs text-slate-400">
                Analysis recommended:{" "}
                {formatStrategyLabel(d.analysis.recommendedStrategy)}
              </p>
            ) : null}
          </DeliverableSection>
        ) : null}

        <DeliverableSection id="summary" title="Summary">
          {d.analysis ? (
            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm">
              {(() => {
                const gap = getSummaryIdentifiedGap(d.analysis, d.claimMeta);
                return (
                  <>
                    <p className="text-[11px] text-slate-500">Identified gap</p>
                    <p className="mt-1 text-lg font-semibold text-slate-50">
                      {gap.estimatedGapLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Carrier {formatMoney(d.analysis.carrierAmount)} · true
                      loss {formatMoney(gap.displayLow)} –{" "}
                      {formatMoney(gap.displayHigh)}
                    </p>
                  </>
                );
              })()}
            </div>
          ) : null}
          <SummaryReadable data={d.summary} />
        </DeliverableSection>

        {hasLetterType ? (
          <DeliverableSection id="letter" title="Letter">
            {hasLetter ? (
              <div className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-200">
                {d.letterRaw}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-4 py-8 text-center">
                <p className="text-sm text-slate-400">
                  Letter type selected ({d.letterType}) but no letter generated
                  yet.
                </p>
                <Link
                  href="/upload?step=6"
                  className="mt-4 inline-flex rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF]"
                >
                  Generate letter in wizard
                </Link>
              </div>
            )}
          </DeliverableSection>
        ) : (
          <DeliverableSection id="letter" title="Letter">
            <p className="text-sm text-slate-400">
              No letter type was chosen during the preview. You can select one in
              the wizard.
            </p>
            <Link
              href="/upload?step=6"
              className="mt-4 inline-flex rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
            >
              Go to letter step
            </Link>
          </DeliverableSection>
        )}
      </div>
    </>
  );
}

function FindingList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-200">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">None listed</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-100">{formatMoney(value)}</p>
    </div>
  );
}

export function DeliverablesHubClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<WizardDeliverables | null>(
    null
  );
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [createdLabel, setCreatedLabel] = useState(
    new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const loadFromReviewId = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data: review, error: revErr } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (revErr || !review) {
      setError("Could not load saved review.");
      return;
    }

    const analysis = review.ai_analysis_json
      ? parseAnalysisResult(review.ai_analysis_json)
      : null;
    const comparison = review.ai_comparison_json
      ? parseComparisonResult(review.ai_comparison_json)
      : null;

    const rawAnalysis = review.ai_analysis_json as
      | { claimMeta?: Partial<WizardDeliverables["claimMeta"]> }
      | null;
    const claimFromAnalysis = rawAnalysis?.claimMeta ?? {};

    setDeliverables({
      claimMeta: {
        insuredName: review.insured_name ?? claimFromAnalysis.insuredName ?? "",
        carrierName: claimFromAnalysis.carrierName ?? "",
        claimType: claimFromAnalysis.claimType ?? "",
        state: claimFromAnalysis.state ?? "",
        policyNumber: claimFromAnalysis.policyNumber ?? "",
        claimNumber: claimFromAnalysis.claimNumber ?? "",
        dateOfLoss: claimFromAnalysis.dateOfLoss ?? "",
        adjusterName: claimFromAnalysis.adjusterName ?? "",
        responseDeadline: claimFromAnalysis.responseDeadline ?? "",
      },
      analysis,
      comparison,
      strategy: analysis?.recommendedStrategy ?? null,
      summary: review.ai_summary_json,
      letterType: review.letter_type,
      letterRaw: review.letter_text,
      savedStep: 6,
    });
    setReviewId(review.id);
    if (review.created_at) {
      setCreatedLabel(
        new Date(review.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const paramReviewId = searchParams?.get("reviewId") ?? null;
      const storedReviewId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(DELIVERABLES_REVIEW_ID_KEY)
          : null;
      const existingId = paramReviewId || storedReviewId;

      const snapRaw =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(WIZARD_STATE_STORAGE_KEY)
          : null;
      const snap = tryParseWizardSnapshot(snapRaw);

      if (snap) {
        const d = deliverablesFromSnapshot(snap);
        if (!cancelled) setDeliverables(d);

        const alreadySaved =
          existingId ||
          (typeof window !== "undefined"
            ? window.sessionStorage.getItem(DELIVERABLES_REVIEW_ID_KEY)
            : null);

        if (!alreadySaved) {
          const saved = await saveWizardReview({
            claimMeta: d.claimMeta,
            analysis: d.analysis,
            comparison: d.comparison,
            summary: d.summary,
            letterType: d.letterType,
            letterText: d.letterRaw,
          });
          if (cancelled) return;
          if (saved.ok) {
            setReviewId(saved.reviewId);
            window.sessionStorage.setItem(
              DELIVERABLES_REVIEW_ID_KEY,
              saved.reviewId
            );
            router.replace(`/deliverables?reviewId=${saved.reviewId}`, {
              scroll: false,
            });
          } else {
            setError(
              "Your deliverables are shown below, but saving to your account failed. Try again from the wizard."
            );
          }
        } else if (existingId) {
          setReviewId(existingId);
        }

        if (!cancelled) setLoading(false);
        return;
      }

      if (existingId) {
        await loadFromReviewId(existingId);
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) {
        setError("No review data found. Start from the upload wizard or preview.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFromReviewId, router, searchParams]);

  const title = useMemo(
    () => (deliverables ? deliverablesTitle(deliverables) : "Your deliverables"),
    [deliverables]
  );

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6 py-16">
        <p className="text-sm text-slate-400">Loading your deliverables…</p>
      </main>
    );
  }

  if (error && !deliverables) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-sm text-amber-300">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Go to wizard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200"
          >
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!deliverables) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">
      <div>
        <p className="text-xs font-medium text-emerald-400/90">
          Payment complete — your analysis is unlocked
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
          {title}
        </h1>
        <p className="mt-1 text-xs text-slate-400">Saved {createdLabel}</p>
        {error ? (
          <p className="mt-3 text-sm text-amber-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <DeliverablesBody
        d={deliverables}
        reviewId={reviewId}
        createdLabel={createdLabel}
      />
    </main>
  );
}
