import { Fragment, type ReactNode } from "react";
import { buildPlaceholderFieldsFromStoredJson } from "@/lib/letter-placeholder-extract";

const PLACEHOLDER_TOKEN_ORDER = [
  "[RESPONSE DEADLINE]",
  "[DISPUTED AMOUNT]",
  "[CARRIER NAME]",
  "[ADJUSTER NAME]",
  "[DATE OF LOSS]",
  "[CLAIM NUMBER]",
  "[POLICY NUMBER]",
  "[INSURED NAME]",
  "[TODAY'S DATE]",
] as const;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlaceholderSplitRegex(): RegExp {
  const tokenAlts = [...PLACEHOLDER_TOKEN_ORDER]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join("|");
  return new RegExp(`(${tokenAlts}|\\[[^\\]]+\\])`, "g");
}

/** Reused; reset lastIndex before each split. */
const SPLIT_RE = buildPlaceholderSplitRegex();

function todaysDateDisplay(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function pickString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const ANALYSIS_KEYS: [string, string][] = [
  ["insuredName", "[INSURED NAME]"],
  ["insured_name", "[INSURED NAME]"],
  ["policyNumber", "[POLICY NUMBER]"],
  ["policy_number", "[POLICY NUMBER]"],
  ["claimNumber", "[CLAIM NUMBER]"],
  ["claim_number", "[CLAIM NUMBER]"],
  ["dateOfLoss", "[DATE OF LOSS]"],
  ["date_of_loss", "[DATE OF LOSS]"],
  ["adjusterName", "[ADJUSTER NAME]"],
  ["adjuster_name", "[ADJUSTER NAME]"],
  ["carrierName", "[CARRIER NAME]"],
  ["carrier_name", "[CARRIER NAME]"],
  ["responseDeadline", "[RESPONSE DEADLINE]"],
  ["response_deadline", "[RESPONSE DEADLINE]"],
  ["disputedAmount", "[DISPUTED AMOUNT]"],
  ["disputed_amount", "[DISPUTED AMOUNT]"],
];

/**
 * Map token → replacement. Fills from `claimMeta` / `property_details` / top-level
 * keys on `ai_analysis_json` and optional `ai_summary_json`, plus the review insured
 * name. [TODAY'S DATE] is the current date in the UI. Remaining bracket tokens are
 * highlighted in the display.
 */
export function buildLetterPlaceholderValueMap(
  insuredName: string | null | undefined,
  analysisRaw?: unknown,
  summaryRaw?: unknown
): Map<string, string> {
  const m = new Map<string, string>();
  m.set("[TODAY'S DATE]", todaysDateDisplay());

  const fields = buildPlaceholderFieldsFromStoredJson(
    insuredName,
    analysisRaw,
    summaryRaw
  );
  const setIf = (token: string, val: string) => {
    const t = val?.trim();
    if (t) m.set(token, t);
  };
  setIf("[INSURED NAME]", fields.insured);
  setIf("[CLAIM NUMBER]", fields.claim);
  setIf("[DISPUTED AMOUNT]", fields.amount);
  setIf("[RESPONSE DEADLINE]", fields.responseDeadline);

  if (isRecord(analysisRaw)) {
    for (const [k, token] of ANALYSIS_KEYS) {
      if (m.get(token)?.trim()) continue;
      const v = pickString(analysisRaw[k]);
      if (v) m.set(token, v);
    }
  }

  const fromReview = pickString(insuredName);
  if (fromReview) m.set("[INSURED NAME]", fromReview);

  return m;
}

/**
 * Splits `letter` on bracket tokens, replacing mapped values and highlighting unknown
 * `[...]` tokens for manual completion.
 */
export function letterTextToReactNodes(
  letter: string,
  valueMap: Map<string, string>,
  highlightClassName: string
): ReactNode {
  SPLIT_RE.lastIndex = 0;
  const segments = letter.split(SPLIT_RE);
  const parts: ReactNode[] = [];
  let k = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === undefined || seg === "") continue;
    if (i % 2 === 0) {
      parts.push(<Fragment key={`t-${k++}`}>{seg}</Fragment>);
      continue;
    }
    const value = valueMap.get(seg);
    if (value !== undefined) {
      parts.push(<Fragment key={`r-${k++}`}>{value}</Fragment>);
    } else if (/^\[[^\]]+\]$/.test(seg)) {
      parts.push(
        <mark key={`p-${k++}`} className={highlightClassName}>
          {seg}
        </mark>
      );
    } else {
      parts.push(<Fragment key={`o-${k++}`}>{seg}</Fragment>);
    }
  }
  return <>{parts}</>;
}
