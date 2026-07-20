import {
  parseAnalysisResult,
  parseComparisonResult,
  type AnalysisResult,
  type ComparisonResult,
} from "@/lib/review-json-types";
import { letterPlaceholdersFromClaimMeta } from "@/lib/estimate-letter-placeholders";
import type { SerializableWizardV1 } from "@/lib/wizard-snapshot";
import { writeWizardResumeSnapshot } from "@/lib/wizard-snapshot";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export type WizardClaimMeta = {
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

export type WizardDeliverables = {
  claimMeta: WizardClaimMeta;
  analysis: AnalysisResult | null;
  comparison: ComparisonResult | null;
  strategy: string | null;
  summary: unknown;
  letterType: string | null;
  letterRaw: string | null;
  savedStep: number;
};

const EMPTY_CLAIM_META: WizardClaimMeta = {
  insuredName: "",
  carrierName: "",
  claimType: "",
  state: "",
  policyNumber: "",
  claimNumber: "",
  dateOfLoss: "",
  adjusterName: "",
  responseDeadline: "",
};

function firstParsedAnalysis(
  analyses: Record<string, unknown> | null | undefined
): AnalysisResult | null {
  if (!analyses || typeof analyses !== "object") return null;
  for (const v of Object.values(analyses)) {
    const p = parseAnalysisResult(v);
    if (p) return p;
  }
  return null;
}

function firstParsedComparison(
  comparisons: Record<string, unknown> | null | undefined
): ComparisonResult | null {
  if (!comparisons || typeof comparisons !== "object") return null;
  for (const v of Object.values(comparisons)) {
    const p = parseComparisonResult(v);
    if (p) return p;
  }
  return null;
}

function firstStrategy(
  strategies: Record<string, unknown> | null | undefined
): string | null {
  if (!strategies || typeof strategies !== "object") return null;
  for (const v of Object.values(strategies)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Category key used when rebuilding wizard state from a saved review (no documents). */
const RESUME_CATEGORY_KEY = "BUILDING";

export type ReviewRowForDeliverables = {
  insured_name?: string | null;
  ai_analysis_json?: unknown;
  ai_comparison_json?: unknown;
  ai_summary_json?: unknown;
  letter_type?: string | null;
  letter_text?: string | null;
};

export function deliverablesFromReviewRow(
  review: ReviewRowForDeliverables
): WizardDeliverables {
  const analysis = review.ai_analysis_json
    ? parseAnalysisResult(review.ai_analysis_json)
    : null;
  const comparison = review.ai_comparison_json
    ? parseComparisonResult(review.ai_comparison_json)
    : null;

  const rawAnalysis = review.ai_analysis_json as
    | { claimMeta?: Partial<WizardClaimMeta> }
    | null;
  const claimFromAnalysis = rawAnalysis?.claimMeta ?? {};

  return {
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
    summary: review.ai_summary_json ?? null,
    letterType: review.letter_type ?? null,
    letterRaw: review.letter_text?.trim() ? review.letter_text : null,
    savedStep: 6,
  };
}

export async function fetchDeliverablesForReviewId(
  reviewId: string
): Promise<WizardDeliverables | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (error || !review) return null;
  return deliverablesFromReviewRow(review);
}

/** Rebuild a wizard session snapshot from deliverables / saved review data. */
export function wizardSnapshotFromDeliverables(
  d: WizardDeliverables,
  currentStep?: number
): SerializableWizardV1 {
  const step = Math.min(
    6,
    Math.max(2, currentStep ?? d.savedStep ?? 2)
  );
  const analyses: Record<string, AnalysisResult> = {};
  const comparisons: Record<string, ComparisonResult> = {};
  const strategies: Record<string, string> = {};
  if (d.analysis) analyses[RESUME_CATEGORY_KEY] = d.analysis;
  if (d.comparison) comparisons[RESUME_CATEGORY_KEY] = d.comparison;
  const strat =
    d.strategy?.trim() || d.analysis?.recommendedStrategy?.trim() || null;
  if (strat) strategies[RESUME_CATEGORY_KEY] = strat;

  return {
    v: 1,
    currentStep: step,
    documents: [],
    claimMeta: d.claimMeta,
    analyses,
    comparisons,
    strategies,
    letterType: d.letterType,
    letterRaw: d.letterRaw,
    letterPlaceholders: letterPlaceholdersFromClaimMeta(d.claimMeta),
    prefillApplied: Boolean(d.letterRaw?.trim()),
    summary: d.summary ?? null,
  };
}

export function deliverablesFromSnapshot(
  snap: SerializableWizardV1
): WizardDeliverables {
  const rawMeta =
    snap.claimMeta && typeof snap.claimMeta === "object"
      ? (snap.claimMeta as Partial<WizardClaimMeta>)
      : {};
  const claimMeta: WizardClaimMeta = { ...EMPTY_CLAIM_META, ...rawMeta };
  const analyses = snap.analyses as Record<string, unknown> | undefined;
  const comparisons = snap.comparisons as Record<string, unknown> | undefined;
  const strategies = snap.strategies as Record<string, unknown> | undefined;

  const analysis = firstParsedAnalysis(analyses);
  const comparison = firstParsedComparison(comparisons);
  const strategy =
    firstStrategy(strategies) ??
    (analysis?.recommendedStrategy?.trim() || null);

  return {
    claimMeta,
    analysis,
    comparison,
    strategy,
    summary: snap.summary ?? null,
    letterType: snap.letterType ?? null,
    letterRaw: snap.letterRaw?.trim() ? snap.letterRaw : null,
    savedStep: snap.currentStep,
  };
}

export function deliverablesTitle(d: WizardDeliverables): string {
  return d.claimMeta.insuredName?.trim() || "Denial Appeal";
}

export function safeDeliverablesFileName(title: string): string {
  return (
    title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "denial-appeal"
  );
}

/** Write snapshot and build /upload URL for resuming this review in the wizard. */
export function buildResumedWizardUploadUrl(
  d: WizardDeliverables,
  options?: {
    reviewId?: string | null;
    step?: number;
    letterType?: string | null;
    letterRaw?: string | null;
  }
): string {
  const resumeStep = Math.min(
    6,
    Math.max(
      2,
      options?.step ?? (d.savedStep >= 2 ? d.savedStep : 2)
    )
  );
  const snap = wizardSnapshotFromDeliverables(
    {
      ...d,
      letterType: options?.letterType ?? d.letterType,
      letterRaw: options?.letterRaw ?? d.letterRaw,
      savedStep: resumeStep,
    },
    resumeStep
  );
  writeWizardResumeSnapshot(snap, options?.reviewId ?? null);
  const reviewId = options?.reviewId?.trim();
  return reviewId
    ? `/upload?reviewId=${encodeURIComponent(reviewId)}&step=${resumeStep}`
    : `/upload?step=${resumeStep}`;
}
