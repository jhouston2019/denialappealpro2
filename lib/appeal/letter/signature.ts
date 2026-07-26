import { getValue } from "../ledger/builder";
import { FACT_LABELS } from "../ledger/keys";
import type { FactLedger } from "../ledger/types";

const MONTH =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const US_SLASH = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

/** True when a string looks like a calendar date (the live signer-slot bug). */
export function isDateShapedString(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return MONTH.test(s) || ISO.test(s) || US_SLASH.test(s);
}

function line(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * System-rendered signature block bound only to signer.* ledger facts.
 * Never inserts today's date as the signer name.
 */
export function assembleSignatureBlock(ledger: FactLedger): string {
  const lines = ["Sincerely,"];
  const name = line(getValue(ledger, "signer.name"));
  const title = line(getValue(ledger, "signer.title"));
  const credentials = line(getValue(ledger, "signer.credentials"));
  const phone = line(getValue(ledger, "signer.phone"));

  lines.push(
    name || `[[REQUIRED: signer.name — ${FACT_LABELS["signer.name"]}]]`
  );
  lines.push(
    title || `[[REQUIRED: signer.title — ${FACT_LABELS["signer.title"]}]]`
  );
  if (credentials) lines.push(credentials);
  if (phone) lines.push(phone);

  return lines.join("\n");
}

/** Strip a model-written Sincerely block (and anything after) before system rebind. */
export function stripTrailingSignature(letterBody: string): string {
  const text = String(letterBody || "");
  const idx = text.search(/\nSincerely,?[\s\S]*$/i);
  if (idx >= 0) return text.slice(0, idx).replace(/\s+$/, "");
  if (/^Sincerely,?/i.test(text.trim())) {
    return "";
  }
  return text.replace(/\s+$/, "");
}
