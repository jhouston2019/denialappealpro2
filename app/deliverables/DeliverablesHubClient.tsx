"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@/app/upload/dap-wizard.css";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { createSupabaseBrowserClient, wizardFetch } from "@/lib/supabaseClient";
import { ReviewNavCtaLink } from "@/components/billing/ReviewNavCtaLink";
import type { ReviewNavBillingInput } from "@/lib/billing/reviewNavCta";
import { DELIVERABLES_REVIEW_ID_KEY } from "@/lib/wizard-snapshot";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

type StoredIntake = Partial<DenialIntake> & {
  payerName?: string;
  icd10Codes?: string[];
};

type ReviewRow = {
  id: string;
  letter_text: string | null;
  insured_name: string | null;
  created_at: string | null;
  ai_summary_json: unknown;
};

function parseIntakeFromReview(row: ReviewRow): StoredIntake | null {
  const summary = row.ai_summary_json;
  if (!summary || typeof summary !== "object") return null;
  const s = summary as { intake?: StoredIntake };
  if (s.intake && typeof s.intake === "object") return s.intake;
  return null;
}

function intakeSummary(intake: StoredIntake | null, row: ReviewRow) {
  const patient =
    intake?.patientName || row.insured_name || "Patient";
  const payer = intake?.payer || intake?.payerName || "—";
  const claim = intake?.claimNumber || "—";
  const dos = intake?.dateOfService || "—";
  const provider = intake?.providerName || "—";
  const npi = intake?.providerNpi || "—";
  const carc = (intake?.carcCodes || []).join(", ") || "—";
  const rarc = (intake?.rarcCodes || []).join(", ") || "—";
  const cpt = (intake?.cptCodes || []).join(", ") || "—";
  const icd = (intake?.icdCodes || intake?.icd10Codes || []).join(", ") || "—";
  const billed = intake?.billedAmount || "—";
  const paid = intake?.paidAmount || "—";
  return { patient, payer, claim, dos, provider, npi, carc, rarc, cpt, icd, billed, paid };
}

type DeliverablesHubClientProps = {
  reviewNavBilling: ReviewNavBillingInput;
};

export function DeliverablesHubClient({
  reviewNavBilling,
}: DeliverablesHubClientProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [intake, setIntake] = useState<StoredIntake | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<"pdf" | "docx" | null>(null);

  const loadFromReviewId = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data: reviewRow, error: revErr } = await supabase
      .from("reviews")
      .select("id, letter_text, insured_name, created_at, ai_summary_json")
      .eq("id", id)
      .maybeSingle();

    if (revErr || !reviewRow) {
      setError("Could not load saved appeal.");
      return;
    }

    setReview(reviewRow as ReviewRow);
    setIntake(parseIntakeFromReview(reviewRow as ReviewRow));
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DELIVERABLES_REVIEW_ID_KEY, reviewRow.id);
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
      const reviewId = paramReviewId || storedReviewId;

      if (!reviewId) {
        if (!cancelled) {
          setError("No appeal found. Start from the upload wizard.");
          setLoading(false);
        }
        return;
      }

      await loadFromReviewId(reviewId);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFromReviewId, searchParams]);

  const summary = useMemo(
    () => (review ? intakeSummary(intake, review) : null),
    [intake, review]
  );

  const letterText = review?.letter_text?.trim() || "";

  const handleCopy = useCallback(async () => {
    if (!letterText) return;
    try {
      await navigator.clipboard.writeText(letterText);
      setCopyMsg("Copied to clipboard.");
    } catch {
      setCopyMsg("Could not copy to clipboard.");
    }
  }, [letterText]);

  const handleDownload = useCallback(
    async (kind: "pdf" | "docx") => {
      if (!letterText) return;
      setDownloadBusy(kind);
      try {
        const fileName =
          kind === "pdf"
            ? `appeal-letter-${review?.id || "export"}.pdf`
            : `appeal-letter-${review?.id || "export"}.docx`;
        const endpoint =
          kind === "pdf" ? "generate-pdf" : "generate-docx";
        const res = await wizardFetch(netlifyFunctionUrl(endpoint), {
          method: "POST",
          body: JSON.stringify({ text: letterText, fileName }),
        });
        if (!res.ok) {
          setCopyMsg(`Download failed (HTTP ${res.status}).`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        setCopyMsg(`${kind.toUpperCase()} downloaded.`);
      } catch {
        setCopyMsg("Download failed.");
      } finally {
        setDownloadBusy(null);
      }
    },
    [letterText, review?.id]
  );

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6 py-16">
        <p className="text-sm text-[#8aacc8]">Loading your appeal…</p>
      </main>
    );
  }

  if (error && !review) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-sm text-[#f0a050]">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/upload" className="dap-btn-cta">
            Start New Appeal
          </Link>
          <Link href="/dashboard" className="dap-btn-ghost">
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!review || !summary) {
    return null;
  }

  const createdLabel = review.created_at
    ? new Date(review.created_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-3 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[#8aacc8]">
          Appeal deliverables
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-400">
          Payment complete — your appeal letter is ready
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#e8f0f8]">
          {summary.patient} — {summary.payer}
        </h1>
        {createdLabel ? (
          <p className="mt-1 text-xs text-[#8aacc8]">Saved {createdLabel}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="dap-btn-cta"
          disabled={!letterText || downloadBusy !== null}
          onClick={() => void handleDownload("pdf")}
        >
          {downloadBusy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button
          type="button"
          className="dap-btn-ghost"
          disabled={!letterText || downloadBusy !== null}
          onClick={() => void handleDownload("docx")}
        >
          {downloadBusy === "docx" ? "Preparing Word…" : "Download Word"}
        </button>
        <button
          type="button"
          className="dap-btn-ghost"
          disabled={!letterText}
          onClick={() => void handleCopy()}
        >
          Copy to clipboard
        </button>
        <Link href="/upload" className="dap-btn-ghost">
          Start New Appeal
        </Link>
        <ReviewNavCtaLink billing={reviewNavBilling} variant="ghost-cta" />
      </div>

      {copyMsg ? (
        <p className="text-sm text-[#8aacc8]" role="status">
          {copyMsg}
        </p>
      ) : null}

      <section className={WIZARD_PANEL}>
        <h2 className="text-lg font-semibold text-[#1a2a3a]">Claim summary</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Patient</dt>
            <dd>{summary.patient}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Payer</dt>
            <dd>{summary.payer}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Claim</dt>
            <dd>{summary.claim}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">DOS</dt>
            <dd>{summary.dos}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Provider</dt>
            <dd>{summary.provider}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">NPI</dt>
            <dd>{summary.npi}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">CARC</dt>
            <dd>{summary.carc}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">RARC</dt>
            <dd>{summary.rarc}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">CPT</dt>
            <dd>{summary.cpt}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">ICD-10</dt>
            <dd>{summary.icd}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Billed</dt>
            <dd>${summary.billed}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#8a9aaa]">Paid</dt>
            <dd>${summary.paid}</dd>
          </div>
        </dl>
      </section>

      <section className={WIZARD_PANEL}>
        <h2 className="text-lg font-semibold text-[#1a2a3a]">Appeal letter</h2>
        {letterText ? (
          <pre className="mt-4 max-h-[640px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1a2a3a]">
            {letterText}
          </pre>
        ) : (
          <p className="mt-4 text-sm text-[#5a6a7a]">
            No letter text saved for this review.
          </p>
        )}
      </section>
    </main>
  );
}
