"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Step2AnalysisPanel } from "@/app/upload/step2-analysis-panel";
import { Step3ComparisonPanel } from "@/app/upload/step3-comparison-panel";
import { Step4StrategyPanel } from "@/app/upload/step4-strategy-panel";
import { Step5SummaryPanel } from "@/app/upload/step5-summary-panel";
import {
  Step6LetterPanel,
  applyPlaceholdersToLetter,
  letterPlaceholdersFromClaimMeta,
  type LetterPlaceholderFields,
} from "@/app/upload/step6-letter-panel";
import "@/app/upload/erp-wizard.css";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { saveWizardReview } from "@/lib/save-wizard-review";
import { createSupabaseBrowserClient, wizardFetch } from "@/lib/supabaseClient";
import {
  deliverablesFromSnapshot,
  deliverablesFromReviewRow,
  deliverablesTitle,
  buildResumedWizardUploadUrl,
  wizardSnapshotFromDeliverables,
  type WizardDeliverables,
} from "@/lib/wizard-deliverables";
import {
  DELIVERABLES_REVIEW_ID_KEY,
  tryParseWizardSnapshot,
  WIZARD_STATE_STORAGE_KEY,
  writeWizardResumeSnapshot,
} from "@/lib/wizard-snapshot";

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

function noop() {}

function DeliverablesBody({
  d,
  reviewId,
}: {
  d: WizardDeliverables;
  reviewId: string | null;
}) {
  const router = useRouter();
  const strategy =
    d.strategy?.trim() || d.analysis?.recommendedStrategy?.trim() || null;

  const [letterType, setLetterType] = useState<string | null>(d.letterType);
  const [letterRaw, setLetterRaw] = useState<string | null>(d.letterRaw);
  const [letterPlaceholders, setLetterPlaceholders] =
    useState<LetterPlaceholderFields>(() =>
      letterPlaceholdersFromClaimMeta(d.claimMeta)
    );
  const [letterGenerateLoading, setLetterGenerateLoading] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState<string | null>(null);

  useEffect(() => {
    setLetterType(d.letterType);
    setLetterRaw(d.letterRaw);
    setLetterPlaceholders(letterPlaceholdersFromClaimMeta(d.claimMeta));
  }, [d]);

  const announce = useCallback((message: string) => {
    setAnnounceMsg(message);
  }, []);

  const onGenerateLetter = useCallback(async () => {
    if (!letterType || !d.analysis || !strategy) {
      announce(
        "Select a letter type and ensure analysis and strategy are set."
      );
      return;
    }
    setLetterGenerateLoading(true);
    try {
      const res = await wizardFetch(
        netlifyFunctionUrl("generate-estimate-letter"),
        {
          method: "POST",
          body: JSON.stringify({
            analysis: d.analysis,
            strategy,
            claimType: d.claimMeta.claimType,
            letterType,
            tone: "FORMAL_PROFESSIONAL",
          }),
        }
      );
      if (!res.ok) {
        await res.text().catch(() => "");
        announce(
          `Letter could not be generated (HTTP ${res.status}). Try again from the wizard.`
        );
        return;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        announce("Letter endpoint returned an unexpected response.");
        return;
      }
      const text = await res.text();
      const merged = applyPlaceholdersToLetter(text, letterPlaceholders);
      setLetterRaw(merged);
      announce(
        text.trim()
          ? "Letter generated."
          : "Letter response was empty."
      );
    } catch {
      announce("Letter generation failed. Try again from the wizard.");
    } finally {
      setLetterGenerateLoading(false);
    }
  }, [announce, d.analysis, d.claimMeta.claimType, letterPlaceholders, letterType, strategy]);

  const openInWizard = useCallback(
    (step?: number) => {
      router.push(
        buildResumedWizardUploadUrl(
          {
            ...d,
            letterType,
            letterRaw,
          },
          { reviewId, step }
        )
      );
    },
    [d, letterRaw, letterType, reviewId, router]
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="erp-btn-ghost"
          onClick={() => openInWizard()}
        >
          Open in wizard
        </button>
        <Link href="/dashboard" className="erp-btn-ghost">
          Dashboard
        </Link>
        <Link href="/pricing" className="erp-btn-cta">
          Buy another review
        </Link>
      </div>

      {announceMsg ? (
        <p className="sr-only" role="status" aria-live="polite">
          {announceMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        {d.analysis ? (
          <section id="deliverables-analysis" className={WIZARD_PANEL}>
            <Step2AnalysisPanel
              analysis={d.analysis}
              comparison={d.comparison}
              onBack={noop}
              onNext={noop}
              announce={announce}
              isPreviewMode={false}
              hideNav
            />
          </section>
        ) : null}

        <section id="deliverables-comparison" className={WIZARD_PANEL}>
          <Step3ComparisonPanel
            comparison={d.comparison}
            claimMeta={{
              insuredName: d.claimMeta.insuredName,
              policyNumber: d.claimMeta.policyNumber,
              claimNumber: d.claimMeta.claimNumber,
              dateOfLoss: d.claimMeta.dateOfLoss,
            }}
            onBack={noop}
            onNext={noop}
            announce={announce}
            isPreviewMode={false}
            hideNav
          />
        </section>

        {d.analysis ? (
          <section id="deliverables-strategy" className={WIZARD_PANEL}>
            <Step4StrategyPanel
              analysis={d.analysis}
              strategy={strategy}
              onStrategyChange={noop}
              onBack={noop}
              onNext={noop}
              announce={announce}
              isPreviewMode={false}
              hideNav
            />
          </section>
        ) : null}

        {d.analysis ? (
          <section id="deliverables-summary" className={WIZARD_PANEL}>
            <Step5SummaryPanel
              analysis={d.analysis}
              comparison={d.comparison}
              strategy={strategy}
              claimMeta={d.claimMeta}
              onBack={noop}
              onGoToLetter={noop}
              onStartOver={noop}
              announce={announce}
              isPreviewMode={false}
              hideNav
            />
          </section>
        ) : null}

        <section id="deliverables-letter" className={WIZARD_PANEL}>
          <Step6LetterPanel
            active
            letterType={letterType}
            onLetterTypeChange={setLetterType}
            letterRaw={letterRaw}
            onLetterChange={setLetterRaw}
            letterPlaceholders={letterPlaceholders}
            onLetterPlaceholdersChange={(patch) =>
              setLetterPlaceholders((prev) => ({ ...prev, ...patch }))
            }
            showLetterEditor={letterRaw !== null}
            generateLoading={letterGenerateLoading}
            onGenerate={onGenerateLetter}
            onBack={noop}
            onStartOver={noop}
            announce={announce}
            isPreviewMode={false}
            hideNav
          />
        </section>
      </div>
    </>
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

    setDeliverables(deliverablesFromReviewRow(review));
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

  useEffect(() => {
    if (!deliverables) return;
    const snap = wizardSnapshotFromDeliverables(deliverables);
    writeWizardResumeSnapshot(snap, reviewId);
  }, [deliverables, reviewId]);

  const title = useMemo(
    () => (deliverables ? deliverablesTitle(deliverables) : "Complete review report"),
    [deliverables]
  );

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6 py-16">
        <p className="text-sm text-[#8aacc8]">Loading your deliverables…</p>
      </main>
    );
  }

  if (error && !deliverables) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-sm text-[#f0a050]">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/upload" className="erp-btn-cta">
            Go to wizard
          </Link>
          <Link href="/dashboard" className="erp-btn-ghost">
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-3 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[#8aacc8]">
          Complete review report
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-400">
          Payment complete — your analysis is unlocked
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#e8f0f8]">
          {title}
        </h1>
        <p className="mt-1 text-xs text-[#8aacc8]">Saved {createdLabel}</p>
        {error ? (
          <p className="mt-3 text-sm text-[#f0a050]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <DeliverablesBody d={deliverables} reviewId={reviewId} />
    </main>
  );
}
