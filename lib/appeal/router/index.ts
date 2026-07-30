import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import { lookupCarc, normalizeCarcCode, type CarcEntry } from "./carc-table";
import {
  carc4M144BundlingEntry,
  isCarc4M144Bundling,
} from "./bundling-detect";
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
  }

  if (strategy.id === "authorization" && branch?.id === "D") {
    lines.push(
      "REQUIRED ARGUMENT THREADS: (1) retroactive authorization review, (2) notice/waiver of auth requirements, (3) disproportionate remedy."
    );
    lines.push(
      "DO NOT characterize the service as emergent, urgent, or unscheduled. Elective procedures are never excused from authorization requirements on an emergent basis."
    );
    lines.push(
      "If claim.authorizationNumber is absent, state that no authorization number is on file and request retroactive authorization review — do not invent a clinical excuse."
    );
  }

  if (strategy.id === "authorization") {
    lines.push(
      "AUTHORIZATION ARGUMENT HIERARCHY: (1) If claim.authorizationNumber is present, cite it and request reprocessing. (2) If auth was not required per plan terms, cite only plan provisions present in the ledger. (3) If auth was denied or lapsed, argue medical necessity only when clinical.* facts are present and request retroactive review. (4) NEVER fabricate emergent/urgent justification for missing authorization."
    );
  }

  if (route.warnings.length) {
    lines.push(`ROUTER WARNINGS: ${route.warnings.join("; ")}`);
  }

  if (isCarc4M144Bundling(ledger)) {
    lines.push(
      "CARC 4 + RARC M144 BUNDLING — REQUIRED ARGUMENT BLOCK (minimum 4 substantive paragraphs):",
      "Paragraph 1 — Modifier 25: The E/M service (CPT 99213) was medically necessary and distinct from the procedure (CPT 93000) performed on the same date. Under CMS NCCI Policy Manual, Chapter 1, modifier 25 exempts significant and separately identifiable E/M services from bundling edits.",
      "Paragraph 2 — Separate medical necessity: The E/M visit addressed a distinct clinical issue requiring independent evaluation beyond the scope of the procedure. The treating provider's documentation supports separate billing.",
      "Paragraph 3 — NCCI edit rebuttal: NCCI column-two edits are not absolute — they are overridable by modifier when clinical circumstances support it. The plan must evaluate the modifier 25 claim on its merits rather than applying a blanket bundling denial.",
      "Paragraph 4 — Resubmission demand: Demand reprocessing with modifier 25 appended to CPT 99213 and full payment of the denied amount from claim.deniedAmount.",
      "Quote the payer EOB instruction when present: resubmit with modifier 25 appended to CPT 99213 if the E/M was significant and separately identifiable.",
      "DO NOT write \"Unknown denial reason.\" DO NOT characterize as a generic non-covered benefit denial."
    );
  }

  return lines.join("\n");
}
