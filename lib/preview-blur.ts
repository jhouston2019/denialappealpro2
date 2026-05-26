/** Fraction of list rows / findings kept readable in preview (≈40% visible, 60% blurred). */
export const PREVIEW_VISIBLE_FRACTION = 0.4;

export const PREVIEW_BLUR_CLASS =
  "filter blur-[4px] select-none [pointer-events:none]";

export function previewVisibleCount(total: number): number {
  if (total <= 0) return 0;
  return Math.max(1, Math.ceil(total * PREVIEW_VISIBLE_FRACTION));
}

export function previewBlurClassForIndex(
  isPreviewMode: boolean,
  index: number,
  total: number
): string {
  if (!isPreviewMode || total <= 0) return "";
  return index >= previewVisibleCount(total) ? PREVIEW_BLUR_CLASS : "";
}

type FindingSource = {
  proceduralDefects?: string[];
  scopeOmissions?: string[];
  pricingFlags?: string[];
  codeUpgradeGaps?: string[];
  opFindings?: string[];
  disputeAngles?: string[];
  actionItems?: string[];
  requiredDocuments?: string[];
  escalationOptions?: string[];
};

/** Global index across all finding lists (matches step 2 preview behavior). */
export function buildPreviewFindingIndex(source: FindingSource): Map<string, number> {
  const m = new Map<string, number>();
  let g = 0;
  const add = (arr: string[] | undefined, prefix: string) => {
    if (!arr) return;
    for (let i = 0; i < arr.length; i += 1) m.set(`${prefix}:${i}`, g++);
  };
  add(source.proceduralDefects, "pc");
  add(source.scopeOmissions, "om");
  add(source.pricingFlags, "pr");
  add(source.codeUpgradeGaps, "cd");
  add(source.opFindings, "op");
  add(source.disputeAngles, "an");
  add(source.actionItems, "ac");
  add(source.requiredDocuments, "rq");
  add(source.escalationOptions, "es");
  return m;
}

export function previewBlurForFindingKey(
  isPreviewMode: boolean,
  indexMap: Map<string, number>,
  key: string
): string {
  if (!isPreviewMode) return "";
  const total = indexMap.size;
  if (total <= 0) return "";
  const idx = indexMap.get(key) ?? 0;
  return previewBlurClassForIndex(true, idx, total);
}

export function previewMoreFindingsCount(
  isPreviewMode: boolean,
  totalFindings: number
): number {
  if (!isPreviewMode || totalFindings <= 0) return 0;
  return Math.max(0, totalFindings - previewVisibleCount(totalFindings));
}

/** Split multiline text for partial letter preview. */
export function splitPreviewLines(text: string): {
  visible: string[];
  blurred: string[];
} {
  const lines = text.split("\n");
  const visibleCount = previewVisibleCount(lines.length);
  return {
    visible: lines.slice(0, visibleCount),
    blurred: lines.slice(visibleCount),
  };
}
