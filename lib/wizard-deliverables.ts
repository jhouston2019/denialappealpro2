import {
  parseAnalysisResult,
  parseComparisonResult,
  type AnalysisResult,
  type ComparisonResult,
} from "@/lib/estimate-json-parse";
import type { SerializableWizardV1 } from "@/lib/wizard-snapshot";

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
  return d.claimMeta.insuredName?.trim() || "Estimate Review";
}

export function safeDeliverablesFileName(title: string): string {
  return (
    title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "estimate-review"
  );
}
