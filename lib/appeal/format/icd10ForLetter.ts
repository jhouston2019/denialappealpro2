import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import { normalizeIcd10Array } from "./normalizeIcd10";

function arr(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Valid ICD-10 codes for letter rendering — excludes placeholders like XXX.XXX. */
export function resolveIcd10CodesForLetter(ledger: FactLedger): string[] {
  const claim = normalizeIcd10Array(arr(getValue(ledger, "claim.icd10Codes")));
  if (claim.length) return claim;
  return normalizeIcd10Array(arr(getValue(ledger, "clinical.icd10Codes")));
}

export function hasValidIcd10Codes(codes: string[] | null | undefined): boolean {
  return normalizeIcd10Array(codes).length > 0;
}
