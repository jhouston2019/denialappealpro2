import { formatCurrency } from "../format/render";
import { resolveFactKeyPlaceholders } from "../format/resolveFactPlaceholders";
import { getValue } from "../ledger/builder";
import { CLINICAL_KEYS } from "../ledger/keys";
import type { FactLedger, FactValue } from "../ledger/types";
import { lookupCarc, normalizeCarcCode, type CarcEntry } from "./carc-table";
import {
  carc4M144BundlingEntry,
  isCarc4M144Bundling,
} from "./bundling-detect";
import { inferAuthBranch } from "./inferBranches";
import {
  buildAuthBranchBLeadArgument,
  getAuthBranch,
  getBundlingBranch,
  getClaimDefectBranch,
  getDuplicateBranch,
  getExperimentalBranch,
  getNonCoveredBranch,
  getStrategy,
  getTimelyFilingBranch,
  getWrongPayerBranch,
  pickPrimaryStrategy,
  type AuthBranchId,
  type BundlingBranchId,
  type ClaimDefectBranchId,
  type DenialStrategy,
  type DuplicateBranchId,
  type ExperimentalBranchId,
  type NonCoveredBranchId,
  type StrategyBranch,
  type StrategyId,
  type TimelyFilingBranchId,
  type WrongPayerBranchId,
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
  if (s === "D") return "B";
  if (s === "A" || s === "B" || s === "C") return s;
  return null;
}

function resolveBundlingBranch(ledger: FactLedger): BundlingBranchId | null {
  const v = getValue(ledger, "appeal.bundlingBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: BundlingBranchId[] = [
    "modifier-25",
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

function resolveClaimDefectBranch(
  ledger: FactLedger
): ClaimDefectBranchId | null {
  const v = getValue(ledger, "appeal.claimDefectBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: ClaimDefectBranchId[] = [
    "missing-info",
    "invalid-info",
    "duplicate-submission-flag",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function resolveNonCoveredBranch(
  ledger: FactLedger
): NonCoveredBranchId | null {
  const v = getValue(ledger, "appeal.nonCoveredBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: NonCoveredBranchId[] = [
    "categorical-exclusion",
    "frequency-limit",
    "benefit-exhausted",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function resolveDuplicateBranch(ledger: FactLedger): DuplicateBranchId | null {
  const v = getValue(ledger, "appeal.duplicateBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: DuplicateBranchId[] = [
    "true-duplicate-error",
    "resubmission-after-correction",
    "split-billing",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function resolveExperimentalBranch(
  ledger: FactLedger
): ExperimentalBranchId | null {
  const v = getValue(ledger, "appeal.experimentalBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: ExperimentalBranchId[] = [
    "fda-approved",
    "off-label",
    "no-ncd",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function resolveWrongPayerBranch(
  ledger: FactLedger
): WrongPayerBranchId | null {
  const v = getValue(ledger, "appeal.wrongPayerBranch");
  if (v == null) return null;
  const s = String(v).trim();
  const allowed: WrongPayerBranchId[] = [
    "primary",
    "secondary",
    "medicare-secondary",
  ];
  return allowed.find((b) => b === s) ?? null;
}

function applyBranchToStrategy(
  baseStrategy: DenialStrategy,
  branch: StrategyBranch
): DenialStrategy {
  return {
    ...baseStrategy,
    leadArgument: branch.leadArgument,
    sectionOrder: branch.sectionOrder ?? baseStrategy.sectionOrder,
    requiredFacts: branch.requiredFacts ?? baseStrategy.requiredFacts,
  };
}

function hasClinicalFactsInLedger(ledger: FactLedger): boolean {
  return CLINICAL_KEYS.some((key) => {
    const v = getValue(ledger, key);
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

function resolveAuthBranchLeadArgument(
  ledger: FactLedger,
  branch: StrategyBranch,
  authBranchId: AuthBranchId
): StrategyBranch {
  if (branch.id !== "B" && authBranchId !== "D") {
    return branch;
  }
  return {
    ...branch,
    leadArgument: buildAuthBranchBLeadArgument(hasClinicalFactsInLedger(ledger)),
  };
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
  const carc4M144 = isCarc4M144Bundling(ledger);
  const effectivePrimaryId = carc4M144 ? "bundling" : primaryId;
  const baseStrategy = getStrategy(effectivePrimaryId);
  let primaryCarc =
    resolvedCarcs.find((c) => c.strategyId === effectivePrimaryId) ??
    resolvedCarcs[0] ??
    null;
  if (carc4M144) {
    primaryCarc = carc4M144BundlingEntry();
    if (!strategyIds.includes("bundling")) {
      strategyIds.push("bundling");
    }
  }

  let strategy: DenialStrategy = baseStrategy;
  let branch: StrategyBranch | null = null;

  if (primaryId === "authorization") {
    const authBranchId =
      resolveAuthBranch(ledger) ?? inferAuthBranch(ledger);
    const baseBranch = getAuthBranch(authBranchId);
    branch = resolveAuthBranchLeadArgument(ledger, baseBranch, authBranchId);
    strategy = applyBranchToStrategy(baseStrategy, branch);
  } else if (effectivePrimaryId === "bundling") {
    let bundlingBranchId = resolveBundlingBranch(ledger);
    if (!bundlingBranchId && carc4M144) {
      bundlingBranchId = "modifier-25";
    }
    if (!bundlingBranchId) {
      warnings.push(
        "bundling branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getBundlingBranch(bundlingBranchId);
      if (branch) {
        strategy = {
          ...baseStrategy,
          leadArgument: branch.leadArgument,
        };
      }
    }
  } else if (effectivePrimaryId === "timely-filing") {
    const tfBranchId = resolveTimelyFilingBranch(ledger);
    if (!tfBranchId) {
      warnings.push(
        "timely filing branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getTimelyFilingBranch(tfBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
    }
  } else if (effectivePrimaryId === "claim-defect") {
    const defectBranchId = resolveClaimDefectBranch(ledger);
    if (!defectBranchId) {
      warnings.push(
        "claim defect branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getClaimDefectBranch(defectBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
    }
  } else if (effectivePrimaryId === "non-covered") {
    const ncBranchId = resolveNonCoveredBranch(ledger);
    if (!ncBranchId) {
      warnings.push(
        "non-covered branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getNonCoveredBranch(ncBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
    }
  } else if (effectivePrimaryId === "duplicate") {
    const dupBranchId = resolveDuplicateBranch(ledger);
    if (!dupBranchId) {
      warnings.push(
        "duplicate branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getDuplicateBranch(dupBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
    }
  } else if (effectivePrimaryId === "experimental") {
    const expBranchId = resolveExperimentalBranch(ledger);
    if (!expBranchId) {
      warnings.push(
        "experimental branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getExperimentalBranch(expBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
    }
  } else if (effectivePrimaryId === "wrong-payer") {
    const wpBranchId = resolveWrongPayerBranch(ledger);
    if (!wpBranchId) {
      warnings.push(
        "wrong payer branch not selected — wizard must ask branch question before generation"
      );
    } else {
      branch = getWrongPayerBranch(wpBranchId);
      strategy = applyBranchToStrategy(baseStrategy, branch);
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
    lines.push(
      "AUTHORIZATION STATUS: Cite claim.authorizationNumber exactly, including date obtained and approving entity if present in the ledger."
    );
    lines.push(
      "DO NOT state that no authorization is on file. DO NOT request retroactive authorization review."
    );
  }

  if (strategy.id === "authorization" && branch?.id === "B") {
    lines.push(
      "AUTHORIZATION STATUS: State that no prior authorization number is on file and request retroactive authorization review."
    );
    lines.push(
      "DO NOT state that an authorization number is on file. DO NOT describe this as a payer processing error."
    );
  }

  if (strategy.id === "authorization" && branch?.id === "C") {
    lines.push(
      "AUTHORIZATION STATUS: State that the plan has not identified the specific provision requiring prior authorization and dispute that authorization was required."
    );
    lines.push(
      "DO NOT state that an authorization number is on file. DO NOT request retroactive authorization review."
    );
  }

  if (route.warnings.length) {
    lines.push(`ROUTER WARNINGS: ${route.warnings.join("; ")}`);
  }

  if (isCarc4M144Bundling(ledger)) {
    const deniedRaw = getValue(ledger, "claim.deniedAmount");
    const denied =
      deniedRaw != null && String(deniedRaw).trim()
        ? formatCurrency(String(deniedRaw))
        : "the denied amount";
    lines.push(
      "CARC 4 + RARC M144 BUNDLING — OMIT bundling/modifier-25 argument paragraphs from your narrative. The system appends a deterministic bundling block after generation.",
      "Do not repeat arguments. Each point must appear exactly once. Do not restate the modifier 25 exemption more than once.",
      `When stating payment demand in other sections, use the denied amount ${denied} — never write raw fact keys like claim.deniedAmount.`,
      "Quote the payer EOB instruction when present: resubmit with modifier 25 appended to CPT 99213 if the E/M was significant and separately identifiable.",
      "DO NOT write \"Unknown denial reason.\" DO NOT characterize as a generic non-covered benefit denial."
    );
  }

  return resolveFactKeyPlaceholders(lines.join("\n"), ledger);
}
