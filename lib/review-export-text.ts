import type { AnalysisResult, ComparisonResult } from "@/lib/review-json-types";

function section(title: string, body: string): string {
  return `${title}\n${"=".repeat(title.length)}\n\n${body.trim()}\n\n`;
}

export function rawJsonExportPlainText(title: string, raw: unknown): string {
  try {
    return section(title, JSON.stringify(raw, null, 2));
  } catch {
    return section(title, String(raw ?? ""));
  }
}

export function buildAnalysisExportPlainText(analysis: AnalysisResult): string {
  const strategy = analysis.recommendedStrategy?.trim();
  const body =
    strategy != null && strategy.length > 0
      ? `Recommended strategy: ${strategy}\n\n${JSON.stringify(analysis, null, 2)}`
      : JSON.stringify(analysis, null, 2);
  return section("Analysis", body);
}

export function buildComparisonPlainText(comparison: ComparisonResult): string {
  return section("Comparison", JSON.stringify(comparison, null, 2));
}

export function buildSummaryExportPlainText(summaryJson: unknown): string {
  return section("Summary", JSON.stringify(summaryJson, null, 2));
}

export function buildFullReportPlainText(args: {
  reportTitle: string;
  createdLabel: string;
  analysisText: string;
  comparisonText: string | null;
  summaryText: string | null;
  letterOnFileText: string | null;
  newLetterText: string | null;
}): string {
  const parts = [
    `${args.reportTitle}`,
    `Saved: ${args.createdLabel}`,
    "",
    args.analysisText.trim(),
  ];
  if (args.comparisonText?.trim()) parts.push(args.comparisonText.trim());
  if (args.summaryText?.trim()) parts.push(args.summaryText.trim());
  if (args.letterOnFileText?.trim()) {
    parts.push(section("Letter on file", args.letterOnFileText));
  }
  if (args.newLetterText?.trim()) {
    parts.push(section("New letter", args.newLetterText));
  }
  return parts.join("\n\n");
}
