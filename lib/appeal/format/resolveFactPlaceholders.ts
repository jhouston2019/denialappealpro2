import { getValue } from "../ledger/builder";
import type { FactKey, FactLedger } from "../ledger/types";
import { formatCurrency } from "./render";

const FACT_KEY_IN_TEXT =
  /\b(claim|provider|patient|clinical|appeal|signer)\.([a-zA-Z0-9]+)\b/g;

function formatFactValue(key: FactKey, val: unknown): string {
  if (val == null || val === "") return "";
  if (Array.isArray(val)) return val.map(String).filter(Boolean).join(", ");
  const s = String(val).trim();
  if (!s) return "";
  if (key.includes("Amount")) {
    const formatted = formatCurrency(s);
    return formatted || s;
  }
  return s;
}

/** Replace unresolved fact-key tokens (e.g. claim.deniedAmount) with ledger values. */
export function resolveFactKeyPlaceholders(
  text: string,
  ledger: FactLedger
): string {
  return String(text || "").replace(FACT_KEY_IN_TEXT, (match, ns, key) => {
    const factKey = `${ns}.${key}` as FactKey;
    const resolved = formatFactValue(factKey, getValue(ledger, factKey));
    return resolved || match;
  });
}
