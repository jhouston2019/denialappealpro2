import { getValue } from "../ledger/builder";
import type { FactLedger } from "../ledger/types";
import { isCarc4M144Bundling } from "./bundling-detect";
import type {
  AuthBranchId,
  BundlingBranchId,
  TimelyFilingBranchId,
} from "./strategies";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseCodes(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

/** Branch A — auth on file; B — no auth; C — auth requirement disputed. */
export function inferAuthBranch(ledger: FactLedger): AuthBranchId {
  const authNum = str(getValue(ledger, "claim.authorizationNumber"));
  if (authNum) return "A";
  if (isTruthyFlag(getValue(ledger, "claim.authDisputed"))) return "C";
  return "B";
}

export function inferBundlingBranch(ledger: FactLedger): BundlingBranchId {
  if (isCarc4M144Bundling(ledger)) return "modifier-25";
  const modifiers = parseCodes(getValue(ledger, "claim.modifiers")).map((m) =>
    m.toUpperCase()
  );
  if (modifiers.some((m) => m === "25" || m.startsWith("25"))) {
    return "modifier-25";
  }
  if (
    modifiers.some(
      (m) => m === "59" || /^X[EPUGS]/.test(m) || m.startsWith("59")
    )
  ) {
    return "modifier-59";
  }
  return "modifier-25";
}

export function inferTimelyFilingBranch(
  ledger: FactLedger
): TimelyFilingBranchId {
  if (str(getValue(ledger, "claim.goodCauseDescription"))) {
    return "good-cause";
  }
  return "proof-of-timely-submission";
}
