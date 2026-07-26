import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import { lookupCarc, normalizeCarcCode, type CarcEntry } from "./carc-table";
import {
  getAuthBranch,
  getBundlingBranch,
  getStrategy,
  getTimelyFilingBranch,
  pickPrimaryStrategy,
  type AuthBranchId,
  type BundlingBranchId,
  type DenialStrategy,
  type StrategyBranch,
  type StrategyId,
  type TimelyFilingBranchId,
} from "./strategies";

export type { CarcEntry } from "./carc-table";
export type {
  AuthBranchId,
  BundlingBranchId,
  DenialStrategy,
  SectionId,
  StrategyBranch,
  StrategyId,
  TimelyFilingBranchId,
} from "./strategies";
export {
  AUTHORIZATION_STRATEGY,
  BUNDLING_STRATEGY,
  MEDICAL_NECESSITY_STRATEGY,
  TIMELY_FILING_STRATEGY,
  getAuthBranch,
  getBundlingBranch,
  getTimelyFilingBranch,
  getStrategy,
  STRATEGY_PRIORITY,
} from "./strategies";
export {
  lookupCarc,
  normalizeCarcCode,
  allCarcEntries,
  inconsistentCharacterizations,
} from "./carc-table";

export interface RouteDenialResult {
  strategy: DenialStrategy;
  branch: StrategyBranch | null;
  warnings: string[];
  unknownCarcs: string[];
  resolvedCarcs: CarcEntry[];
  resolvedStrategies: StrategyId[];
  primaryCarc: CarcEntry | null;
}

function parseCarcCodes(value: FactValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveAuthBranch(ledger: FactLedger): AuthBranchId | null {
  const v = getValue(ledger, "appeal.authBranch");
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C" || s === "D") return s;
  return null;
}

function resolveBundlingBranch(ledger: FactLedger): BundlingBranchId | null {
  const v = getValue(ledger, "appeal.bundlingBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: BundlingBranchId[] = [
    "modifier-59",
    "no-ncci-edit",
    "modifier-indicator-0",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function resolveTimelyFilingBranch(
  ledger: FactLedger
): TimelyFilingBranchId | null {
  const v = getValue(ledger, "appeal.timelyFilingBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: TimelyFilingBranchId[] = [
    "proof-of-timely-submission",
    "coordination-of-benefits",
    "good-cause",
    "plan-error",
  ];
  return allowed.find((b) => b === s) ?? null;
}

export function routeDenial(ledger: FactLedger): RouteDenialResult {
  const warnings: string[] = [];
  const unknownCarcs: string[] = [];
  const rawCodes = parseCarcCodes(getValue(ledger, "claim.carcCodes"));
  const resolvedCarcs: CarcEntry[] = [];
  const strategyIds: StrategyId[] = [];

  for (const raw of rawCodes) {
    const entry = lookupCarc(raw);
    if (entry) {
      resolvedCarcs.push(entry);
      strategyIds.push(entry.strategyId);
    } else {
      const norm = normalizeCarcCode(raw);
      unknownCarcs.push(norm || raw);
      strategyIds.push("unknown");
      warnings.push(`Unknown CARC code: ${raw}`);
    }
  }

  if (!resolvedCarcs.length && !rawCodes.length) {
    strategyIds.push("unknown");
    warnings.push("No CARC codes in ledger — strategy unknown");
  }

  const primaryId = pickPrimaryStrategy(strategyIds);
  const baseStrategy = getStrategy(primaryId);
  const primaryCarc =
    resolvedCarcs.find((c) => c.strategyId === primaryId) ??
    resolvedCarcs[0] ??
    null;

  let strategy: DenialStrategy = baseStrategy;
  let branch: StrategyBranch | null = null;

  if (primaryId === "authorization") {
    const authBranchId = resolveAuthBranch(ledger);
    if (!authBranchId) {
      warnings.push(
        "auth branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getAuthBranch(authBranchId);
      strategy = {
        ...baseStrategy,
        leadArgument: branch.leadArgument,
        sectionOrder: branch.sectionOrder ?? baseStrategy.sectionOrder,
        requiredFacts: branch.requiredFacts ?? baseStrategy.requiredFacts,
      };
    }
  } else if (primaryId === "bundling") {
    const bundlingBranchId = resolveBundlingBranch(ledger);
    if (!bundlingBranchId) {
      warnings.push(
        "bundling branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getBundlingBranch(bundlingBranchId);
    }
  } else if (primaryId === "timely-filing") {
    const tfBranchId = resolveTimelyFilingBranch(ledger);
    if (!tfBranchId) {
      warnings.push(
        "timely filing branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getTimelyFilingBranch(tfBranchId);
    }
  }

  const resolvedStrategies = [...new Set(strategyIds)];

  return {
    strategy,
    branch,
    warnings,
    unknownCarcs,
    resolvedCarcs,
    resolvedStrategies,
    primaryCarc,
  };
}

/** Build the strategy block appended to the generation user message. */
export function serializeStrategyForPrompt(ledger: FactLedger): string {
  const route = routeDenial(ledger);
  const { strategy, branch, primaryCarc } = route;
  const branchLabel = branch ? `branch-${branch.id}` : "none";
  const descriptor = primaryCarc?.descriptor ?? "Unknown denial reason";
  const admin = primaryCarc?.isAdministrative ?? false;

  const lines = [
    `DENIAL STRATEGY: ${strategy.id} / ${branchLabel}`,
    `LEAD ARGUMENT: ${strategy.leadArgument}`,
    `SECTION ORDER: ${strategy.sectionOrder.join(", ")}`,
    `CARC DESCRIPTOR: ${descriptor}`,
  ];

  if (strategy.clinicalWarning) {
    lines.push(`CLINICAL WARNING: ${strategy.clinicalWarning}`);
  }

  if (branch && strategy.id !== "authorization") {
    lines.push(`BRANCH ARGUMENT (verbatim basis for paragraph 2):`);
    lines.push(branch.leadArgument);
  }

  if (admin && strategy.id !== "medical-necessity") {
    lines.push(
      "DO NOT characterize this denial as a medical necessity denial. It is an administrative denial. Medical necessity is a supporting argument only if clinical.* facts are present in the ledger."
    );
    lines.push(
      'DO NOT describe this denial as "lack of information", "missing information", or "not a covered benefit" unless those exact terms appear in the CARC descriptor above.'
    );
  }

  if (strategy.id === "authorization" && branch?.id === "A") {
    lines.push(
      "TONE: Corrective, not adversarial. Request reprocessing of the claim with the authorization number on file."
    );
  }

  if (strategy.id === "authorization" && branch?.id === "D") {
    lines.push(
      "REQUIRED ARGUMENT THREADS: (1) retroactive authorization, (2) notice/waiver of auth requirements, (3) disproportionate remedy. Clinical argument follows administrative sections only if clinical.* facts are present."
    );
  }

  if (route.warnings.length) {
    lines.push(`ROUTER WARNINGS: ${route.warnings.join("; ")}`);
  }

  return lines.join("\n");
}
