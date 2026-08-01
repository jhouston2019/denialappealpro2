"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FactLedger } from "@/lib/appeal/ledger/types";
import {
  formatCarcList,
  formatRecentAppealDate,
  parseRecentAppealRow,
  reviewStatusBucket,
  reviewValidationGaps,
  type RecentAppealRow,
  type RecentAppealSummary,
  type ReviewStatusFilter,
} from "@/lib/recent-appeals";
import { AppealLetterPdfButton } from "@/components/dashboard/AppealLetterPdfButton";
import { DashboardHeroActions } from "@/components/dashboard/DashboardHeroActions";

type DashboardReviewRow = RecentAppealRow & {
  pdf_report_url?: string | null;
};

type ParsedReview = {
  row: DashboardReviewRow;
  summary: RecentAppealSummary;
  gaps: string[];
  ledger: FactLedger | null;
  statusBucket: Exclude<ReviewStatusFilter, "all">;
};

function parseLedgerFromReview(row: DashboardReviewRow): FactLedger | null {
  const summary = row.ai_summary_json;
  if (!summary || typeof summary !== "object") return null;
  const s = summary as {
    ledger?: FactLedger;
    intake?: { ledger?: FactLedger };
  };
  if (s.ledger && typeof s.ledger === "object" && s.ledger.facts) {
    return s.ledger;
  }
  if (s.intake?.ledger && typeof s.intake.ledger === "object") {
    return s.intake.ledger;
  }
  return null;
}

function StatusBadge({ summary }: { summary: RecentAppealSummary }) {
  const styles = {
    ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    neutral: "border-slate-600 bg-slate-800/80 text-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[summary.statusTone]}`}
    >
      {summary.statusLabel}
    </span>
  );
}

function NeedsReviewGaps({
  gaps,
  reviewId,
}: {
  gaps: string[];
  reviewId: string;
}) {
  const [open, setOpen] = useState(false);
  if (!gaps.length) return null;

  return (
    <div className="mt-2 w-full">
      <button
        type="button"
        className="text-[11px] font-semibold text-amber-300 underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={`gaps-${reviewId}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide gaps" : "Why needs review?"}
      </button>
      {open ? (
        <ul
          id={`gaps-${reviewId}`}
          className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-100/90"
        >
          {gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Props = {
  reviews: DashboardReviewRow[];
  reviewsRemaining: number;
  reviewsLimit: number;
};

export function PastReportsPanel({
  reviews,
  reviewsRemaining,
  reviewsLimit,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const parsed = useMemo<ParsedReview[]>(
    () =>
      reviews.map((row) => {
        const summary = parseRecentAppealRow(row);
        return {
          row,
          summary,
          gaps: reviewValidationGaps(row),
          ledger: parseLedgerFromReview(row),
          statusBucket: reviewStatusBucket(summary),
        };
      }),
    [reviews]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return parsed.filter(({ row, summary, statusBucket }) => {
      if (statusFilter !== "all" && statusBucket !== statusFilter) {
        return false;
      }

      const createdMs = new Date(row.created_at).getTime();
      if (fromMs != null && createdMs < fromMs) return false;
      if (toMs != null && createdMs > toMs) return false;

      if (!q) return true;
      const payer = summary.payer.toLowerCase();
      const patient = summary.patientName.toLowerCase();
      return patient.includes(q) || payer.includes(q);
    });
  }, [dateFrom, dateTo, parsed, search, statusFilter]);

  if (!reviews.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 px-4 py-8 text-center sm:px-6">
        <p className="text-sm text-slate-300">
          No appeals yet. Upload a denial letter or EOB to generate your first
          appeal letter.
        </p>
        <DashboardHeroActions
          reviewsRemaining={reviewsRemaining}
          reviewsLimit={reviewsLimit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Search patient or payer
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or payer…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            From date
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            To date
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ReviewStatusFilter)
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 sm:max-w-xs"
          >
            <option value="all">All</option>
            <option value="ready">Ready</option>
            <option value="needs_review">Needs Review</option>
            <option value="in_progress">In Progress</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-6 text-center text-sm text-slate-400">
          No appeals match your filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
            <table className="min-w-full text-left text-xs text-slate-200">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Payer</th>
                  <th className="px-4 py-3">CARC</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80">
                {filtered.map(({ row, summary, gaps, ledger }) => {
                  const isReady = summary.statusTone === "ready";
                  const isNeedsReview = summary.statusTone === "warning";
                  const letterText = row.letter_text?.trim() ?? "";

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {summary.patientName}
                        {isNeedsReview ? (
                          <NeedsReviewGaps gaps={gaps} reviewId={row.id} />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {summary.payer}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatCarcList(summary.carcCodes)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatRecentAppealDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge summary={summary} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isReady && letterText ? (
                            <AppealLetterPdfButton
                              reviewId={row.id}
                              letterText={letterText}
                              ledger={ledger}
                            />
                          ) : null}
                          {isNeedsReview ? (
                            <Link
                              href={`/deliverables?reviewId=${row.id}`}
                              className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 font-semibold text-amber-100 hover:border-amber-400"
                            >
                              Fix &amp; Download
                            </Link>
                          ) : null}
                          <Link
                            href={`/deliverables?reviewId=${row.id}`}
                            className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 font-semibold hover:border-slate-500 hover:text-slate-50"
                          >
                            View details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map(({ row, summary, gaps, ledger }) => {
              const isReady = summary.statusTone === "ready";
              const isNeedsReview = summary.statusTone === "warning";
              const letterText = row.letter_text?.trim() ?? "";

              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {summary.patientName}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {summary.payer} · {formatCarcList(summary.carcCodes)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatRecentAppealDate(row.created_at)}
                      </p>
                    </div>
                    <StatusBadge summary={summary} />
                  </div>
                  {isNeedsReview ? (
                    <NeedsReviewGaps gaps={gaps} reviewId={row.id} />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isReady && letterText ? (
                      <AppealLetterPdfButton
                        reviewId={row.id}
                        letterText={letterText}
                        ledger={ledger}
                      />
                    ) : null}
                    {isNeedsReview ? (
                      <Link
                        href={`/deliverables?reviewId=${row.id}`}
                        className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100"
                      >
                        Fix &amp; Download
                      </Link>
                    ) : null}
                    <Link
                      href={`/deliverables?reviewId=${row.id}`}
                      className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-[11px] font-semibold"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
