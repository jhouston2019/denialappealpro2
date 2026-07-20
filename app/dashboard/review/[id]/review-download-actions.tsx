"use client";

import { useCallback, useMemo, useState } from "react";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import type { AnalysisResult, ComparisonResult } from "@/lib/review-json-types";
import {
  buildAnalysisExportPlainText,
  buildComparisonPlainText,
  buildFullReportPlainText,
  buildSummaryExportPlainText,
  rawJsonExportPlainText,
} from "@/lib/review-export-text";
import { wizardFetch } from "@/lib/supabaseClient";

type Props = {
  reportTitle: string;
  createdLabel: string;
  analysis: AnalysisResult | null;
  analysisRaw: unknown;
  comparison: ComparisonResult | null;
  comparisonRaw: unknown;
  summaryJson: unknown;
  hasSummary: boolean;
  letterOnFileText: string | null;
  newLetterText: string | null;
  safeBaseFileName: string;
  /** White wizard-style panel (deliverables hub). */
  lightPanel?: boolean;
};

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReviewDownloadActions({
  reportTitle,
  createdLabel,
  analysis,
  analysisRaw,
  comparison,
  comparisonRaw,
  summaryJson,
  hasSummary,
  letterOnFileText,
  newLetterText,
  safeBaseFileName,
  lightPanel = false,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const analysisTextResolved = useMemo((): string | null => {
    if (analysis) return buildAnalysisExportPlainText(analysis);
    if (analysisRaw != null)
      return rawJsonExportPlainText("Analysis (raw)", analysisRaw);
    return null;
  }, [analysis, analysisRaw]);
  const canExportAnalysis = Boolean(analysisTextResolved?.trim());

  const comparisonTextResolved = useMemo((): string | null => {
    if (comparison) return buildComparisonPlainText(comparison);
    if (comparisonRaw != null)
      return rawJsonExportPlainText("Comparison (raw)", comparisonRaw);
    return null;
  }, [comparison, comparisonRaw]);

  const canExportComparison = Boolean(comparisonTextResolved?.trim());

  const doPdf = useCallback(
    async (text: string, fileName: string) => {
      const res = await wizardFetch(netlifyFunctionUrl("generate-pdf"), {
        method: "POST",
        body: JSON.stringify({ text, fileName }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        if (ct.includes("application/json") && raw) {
          try {
            const j = JSON.parse(raw) as { error?: string; details?: string; message?: string };
            const fromFields = [j.error, j.details].filter(Boolean).join(": ");
            const msg = fromFields || j.message || raw;
            throw new Error(msg);
          } catch (e) {
            if (e instanceof SyntaxError) {
              // body was not JSON; fall through to generic
            } else {
              throw e;
            }
          }
        }
        throw new Error("PDF request failed.");
      }
      if (ct.includes("application/json")) {
        throw new Error("PDF request returned JSON instead of a PDF.");
      }
      return res.blob();
    },
    []
  );

  const doDocx = useCallback(
    async (text: string, fileName: string) => {
      const res = await wizardFetch(netlifyFunctionUrl("generate-docx"), {
        method: "POST",
        body: JSON.stringify({ text, fileName }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || ct.includes("application/json")) {
        await res.text().catch(() => "");
        throw new Error("Word export request failed.");
      }
      return res.blob();
    },
    []
  );

  const onAnalysisPdf = useCallback(async () => {
    setErr(null);
    const text = analysisTextResolved;
    if (!text?.trim()) {
      setErr("No analysis data to export.");
      return;
    }
    setBusy("analysis-pdf");
    try {
      const blob = await doPdf(
        text,
        `${safeBaseFileName}-analysis.pdf`
      );
      triggerBlobDownload(blob, `${safeBaseFileName}-analysis.pdf`);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setBusy(null);
    }
  }, [analysisTextResolved, doPdf, safeBaseFileName]);

  const onComparisonPdf = useCallback(async () => {
    setErr(null);
    const text = comparisonTextResolved;
    if (!text?.trim()) {
      setErr("No comparison data to export.");
      return;
    }
    setBusy("comparison-pdf");
    try {
      const blob = await doPdf(
        text,
        `${safeBaseFileName}-comparison.pdf`
      );
      triggerBlobDownload(blob, `${safeBaseFileName}-comparison.pdf`);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setBusy(null);
    }
  }, [comparisonTextResolved, doPdf, safeBaseFileName]);

  const onFullReportPdf = useCallback(async () => {
    setErr(null);
    const analysisText = analysisTextResolved;
    if (!analysisText?.trim()) {
      setErr("No analysis data; full report is not available.");
      return;
    }
    const comparisonText = comparisonTextResolved;
    const summaryText = hasSummary
      ? buildSummaryExportPlainText(summaryJson)
      : null;
    const full = buildFullReportPlainText({
      reportTitle,
      createdLabel,
      analysisText,
      comparisonText: comparisonText?.trim() ? comparisonText : null,
      summaryText: summaryText?.trim() && hasSummary ? summaryText : null,
      letterOnFileText: letterOnFileText?.trim() ? letterOnFileText : null,
      newLetterText: newLetterText?.trim() ? newLetterText : null,
    });
    setBusy("full-pdf");
    try {
      const blob = await doPdf(
        full,
        `${safeBaseFileName}-full-report.pdf`
      );
      triggerBlobDownload(blob, `${safeBaseFileName}-full-report.pdf`);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setBusy(null);
    }
  }, [
    analysisTextResolved,
    comparisonTextResolved,
    createdLabel,
    doPdf,
    hasSummary,
    letterOnFileText,
    newLetterText,
    reportTitle,
    safeBaseFileName,
    summaryJson,
  ]);

  const onLetterOnFileDocx = useCallback(async () => {
    setErr(null);
    const t = letterOnFileText?.trim();
    if (!t) {
      setErr("No letter on file to export.");
      return;
    }
    setBusy("letter-on-file-docx");
    try {
      const blob = await doDocx(
        t,
        `${safeBaseFileName}-letter-on-file.docx`
      );
      triggerBlobDownload(
        blob,
        `${safeBaseFileName}-letter-on-file.docx`
      );
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setBusy(null);
    }
  }, [doDocx, letterOnFileText, safeBaseFileName]);

  const onNewLetterDocx = useCallback(async () => {
    setErr(null);
    const t = newLetterText?.trim();
    if (!t) {
      setErr("No new letter to export. Generate a letter below first.");
      return;
    }
    setBusy("new-letter-docx");
    try {
      const blob = await doDocx(
        t,
        `${safeBaseFileName}-new-letter.docx`
      );
      triggerBlobDownload(blob, `${safeBaseFileName}-new-letter.docx`);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Download failed. Try again."
      );
    } finally {
      setBusy(null);
    }
  }, [doDocx, newLetterText, safeBaseFileName]);

  const btnClass = lightPanel
    ? "dap-btn-ghost-panel disabled:cursor-not-allowed disabled:opacity-50"
    : "rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-left text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      className={
        lightPanel
          ? "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a]"
          : "rounded-3xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-slate-950/50"
      }
    >
      <h2
        className={
          lightPanel
            ? "text-[11px] font-semibold uppercase tracking-[0.07em] text-[#1a2a3a] border-b-[0.5px] border-[#ebebea] pb-2"
            : "text-xs font-semibold uppercase tracking-[0.15em] text-blue-300"
        }
      >
        Downloads
      </h2>
      <p
        className={
          lightPanel
            ? "mt-2 text-sm text-[#7a8a9a]"
            : "mt-2 text-sm text-slate-400"
        }
      >
        Exports use the same PDF and Word services as the upload wizard.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onAnalysisPdf}
          disabled={busy !== null || !canExportAnalysis}
          className={btnClass}
        >
          {busy === "analysis-pdf" ? "Working…" : "Download Analysis (PDF)"}
        </button>
        <button
          type="button"
          onClick={onComparisonPdf}
          disabled={busy !== null || !canExportComparison}
          className={btnClass}
        >
          {busy === "comparison-pdf" ? "Working…" : "Download Comparison (PDF)"}
        </button>
        <button
          type="button"
          onClick={onFullReportPdf}
          disabled={busy !== null || !canExportAnalysis}
          className={btnClass}
        >
          {busy === "full-pdf" ? "Working…" : "Download Full Report (PDF)"}
        </button>
        <button
          type="button"
          onClick={onLetterOnFileDocx}
          disabled={busy !== null || !letterOnFileText?.trim()}
          className={btnClass}
        >
          {busy === "letter-on-file-docx"
            ? "Working…"
            : "Download letter on file (Word)"}
        </button>
        <button
          type="button"
          onClick={onNewLetterDocx}
          disabled={busy !== null || !newLetterText?.trim()}
          className={btnClass}
        >
          {busy === "new-letter-docx" ? "Working…" : "Download new letter (Word)"}
        </button>
      </div>
      {err ? (
        <p
          className={
            lightPanel
              ? "mt-3 text-sm text-[#b83030]"
              : "mt-3 text-sm text-amber-300"
          }
          role="alert"
        >
          {err}
        </p>
      ) : null}
    </section>
  );
}
