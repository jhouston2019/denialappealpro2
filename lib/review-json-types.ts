/** Legacy ERP analysis/comparison JSON shapes — minimal parsers for dashboard compat. */

export type AnalysisResult = {
  recommendedStrategy?: string;
  [key: string]: unknown;
};

export type ComparisonResult = Record<string, unknown>;

export function parseAnalysisResult(raw: unknown): AnalysisResult | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as AnalysisResult;
}

export function parseComparisonResult(raw: unknown): ComparisonResult | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as ComparisonResult;
}
