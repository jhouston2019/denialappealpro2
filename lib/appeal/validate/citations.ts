import type { FactLedger } from "../ledger/types";
import { getValue } from "../ledger/builder";
import type { PlanType } from "../ledger/types";
import { routeDenial } from "../router/index";
import {
  allowedCitationNeedles,
  getAuthorities,
} from "../authorities/gate";
import { GLOBAL_PREAPPROVED_CITATIONS } from "../authorities/allowlist";

const CITATION_PATTERNS: RegExp[] = [
  /\d+\s+U\.S\.C\.\s*§?\s*\d+[a-zA-Z0-9()\-]*/gi,
  /\d+\s+C\.F\.R\.\s*(?:Part\s+\d+|§\s*\d+[\w().\-]*)/gi,
  /§\s*\d+[\w().\-]*/g,
  /\bNCD\b/gi,
  /\bLCD\b/gi,
  /\bNCCI\b/gi,
  /\bERISA\b/gi,
  /\bEMTALA\b/gi,
  /\bAffordable Care Act\b/gi,
  /\bACA\b/g,
  /\bessential health benefits\b/gi,
  /\bprompt.?pay\b/gi,
  /\binsurance commissioner\b/gi,
  /\bMedicare National Coverage\b/gi,
  /\bAAOS\b/g,
  /\bNCCN\b/g,
  /\bACR\b/g,
  /\bACC\b/g,
  /\bAHA\b/g,
  /\bASCO\b/g,
  /\bAAN\b/g,
];

function normalizePlanType(value: unknown): PlanType {
  const s = String(value ?? "").trim();
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

function collectCitationHits(text: string): string[] {
  const input = String(text || "");
  if (!input) return [];
  const hits = new Set<string>();
  for (const re of CITATION_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      hits.add(m[0]);
    }
  }
  return Array.from(hits);
}

function isApprovedHit(hit: string, allowed: string[]): boolean {
  const h = hit.trim().toLowerCase();
  if (!h) return false;
  for (const a of allowed) {
    const al = a.trim().toLowerCase();
    if (!al) continue;
    if (h.includes(al) || al.includes(h)) return true;
  }
  return false;
}

function allowedForLedger(ledger?: FactLedger): string[] {
  if (!ledger) return [];
  const planType = normalizePlanType(getValue(ledger, "patient.planType"));
  const route = routeDenial(ledger);
  const branch = getValue(ledger, "appeal.authBranch");
  const authorities = getAuthorities(
    planType,
    route.strategy.id,
    branch ? String(branch) : undefined,
    ledger
  );
  return [...GLOBAL_PREAPPROVED_CITATIONS, ...allowedCitationNeedles(authorities)];
}

/**
 * Returns citation-shaped substrings not approved for this ledger's plan type and strategy.
 * Without a ledger, every citation-shaped hit is unapproved.
 */
export function findUnapprovedCitations(
  text: string,
  ledger?: FactLedger
): string[] {
  const hits = collectCitationHits(text);
  const allowed = ledger ? allowedForLedger(ledger) : [];
  return hits.filter((h) => !isApprovedHit(h, allowed));
}

export { collectCitationHits, isApprovedHit, allowedForLedger };
