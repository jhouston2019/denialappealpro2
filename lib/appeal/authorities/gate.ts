import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue, PlanType } from "../ledger/types";
import { routeDenial } from "../router/index";
import type { StrategyId } from "../router/strategies";
import {
  AUTHORITY_RECORDS,
  citationStringsFromRecords,
  type AuthorityRecord,
} from "./records";
import { GLOBAL_PREAPPROVED_CITATIONS } from "./allowlist";

export type { AuthorityRecord } from "./records";

/** Normalize payer name from ledger to slug used on authority records. */
export function normalizePayerSlug(name: string): string | null {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  if (n.includes("cigna")) return "cigna";
  if (n.includes("united") || n.includes("uhc")) return "uhc";
  if (n.includes("aetna")) return "aetna";
  if (
    n.includes("blue cross") ||
    n.includes("bluecross") ||
    n.includes("bcbs") ||
    n.includes("anthem") ||
    n.includes("highmark")
  ) {
    return "bcbs";
  }
  return null;
}

function parseCptCodes(value: FactValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cptOverlap(record: AuthorityRecord, claimCpts: string[]): boolean {
  if (!record.cptCodes?.length) return true;
  if (!claimCpts.length) return true;
  const claimSet = new Set(claimCpts.map((c) => c.replace(/\D/g, "") || c));
  return record.cptCodes.some((c) => {
    const norm = c.replace(/\D/g, "") || c;
    return claimSet.has(norm) || claimCpts.includes(c);
  });
}

function passesLedgerFilters(
  record: AuthorityRecord,
  ledger?: FactLedger
): boolean {
  if (!ledger) return true;

  const claimCpts = parseCptCodes(getValue(ledger, "claim.cptCodes"));
  if (!cptOverlap(record, claimCpts)) return false;

  const payerName = String(getValue(ledger, "claim.payerName") ?? "").trim();
  if (!payerName) return true;

  const ledgerSlug = normalizePayerSlug(payerName);
  if (record.payer) {
    if (!ledgerSlug) return true;
    return record.payer === ledgerSlug;
  }
  return true;
}

export function getAuthorities(
  planType: PlanType,
  strategyId: StrategyId,
  branch?: string,
  ledger?: FactLedger
): AuthorityRecord[] {
  void branch;
  if (planType === "unknown") return [];

  return AUTHORITY_RECORDS.filter(
    (r) =>
      r.planTypes.includes(planType) &&
      !r.blocked.includes(planType) &&
      r.strategies.includes(strategyId) &&
      passesLedgerFilters(r, ledger)
  );
}

export function getAuthoritiesForLedger(ledger: FactLedger): AuthorityRecord[] {
  const planType = resolvePlanType(ledger);
  const route = routeDenial(ledger);
  const branch = getValue(ledger, "appeal.authBranch");
  return getAuthorities(
    planType,
    route.strategy.id,
    branch ? String(branch) : undefined,
    ledger
  );
}

function resolvePlanType(ledger: FactLedger): PlanType {
  const v = getValue(ledger, "patient.planType");
  const s = String(v ?? "").trim();
  const allowed: PlanType[] = [
    "erisa-self-funded",
    "fully-insured-group",
    "medicare-advantage",
    "medicaid-mco",
    "marketplace-individual",
    "medicare-traditional",
    "unknown",
  ];
  return (allowed.find((p) => p === s) ?? "unknown") as PlanType;
}

export function serializeAuthoritiesForPrompt(
  records: AuthorityRecord[]
): string {
  if (!records.length) {
    return "AUTHORITIES (use these and only these — do not add, modify, or paraphrase citations):\n(none — write the letter with no regulatory citations)";
  }

  const lines = [
    "AUTHORITIES (use these and only these — do not add, modify, or paraphrase citations):",
  ];
  for (const r of records) {
    lines.push(`[${r.id}]`);
    lines.push(`Citation: ${r.citation}`);
    lines.push(`Argument: ${r.argument}`);
    lines.push(`Quotable: "${r.quotable}"`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function allowedCitationNeedles(records: AuthorityRecord[]): string[] {
  return [
    ...GLOBAL_PREAPPROVED_CITATIONS,
    ...citationStringsFromRecords(records),
  ];
}

export function blockedRecordsForPlanType(
  planType: PlanType
): AuthorityRecord[] {
  return AUTHORITY_RECORDS.filter((r) => r.blocked.includes(planType));
}
