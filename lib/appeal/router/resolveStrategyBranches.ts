import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import { getValue } from "../ledger/builder";
import { ensureLedger } from "../ledger/intakeToLedger";
import type { EnclosureItem, FactLedger, FactValue } from "../ledger/types";
import { isCarc4M144Bundling } from "./bundling-detect";
import { lookupCarc, normalizeCarcCode } from "./carc-table";
import {
  inferAuthBranch,
  inferBundlingBranch,
  inferTimelyFilingBranch,
} from "./inferBranches";
import { pickPrimaryStrategy, type StrategyId } from "./strategies";

function parseCarcCodes(value: FactValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function primaryStrategyId(ledger: FactLedger): StrategyId {
  if (isCarc4M144Bundling(ledger)) return "bundling";
  const rawCodes = parseCarcCodes(getValue(ledger, "claim.carcCodes"));
  const strategyIds = rawCodes.map(
    (raw) => lookupCarc(raw)?.strategyId ?? "unknown"
  );
  if (!strategyIds.length) return "unknown";
  return pickPrimaryStrategy(strategyIds);
}

/** Derive wizard branch fields from extracted CARC/RARC and ledger facts. */
export function applyStrategyBranchesToIntake(
  intake: DenialIntake,
  ledger: FactLedger | null | undefined
): Partial<DenialIntake> {
  if (!ledger) return {};
  const strategyId = primaryStrategyId(ledger);
  const patch: Partial<DenialIntake> = {};

  if (strategyId === "authorization") {
    patch.authBranch = inferAuthBranch(ledger);
  } else if (strategyId === "bundling") {
    patch.bundlingBranch = inferBundlingBranch(ledger);
  } else if (strategyId === "timely-filing") {
    patch.timelyFilingBranch = inferTimelyFilingBranch(ledger);
  }

  return patch;
}

export function ensureLedgerWithStrategyBranches(
  ledger: FactLedger | null | undefined,
  intake: DenialIntake,
  enclosures?: EnclosureItem[]
): FactLedger {
  const branchPatch = applyStrategyBranchesToIntake(intake, ledger);
  const mergedIntake: DenialIntake = { ...intake, ...branchPatch };
  return ensureLedger(ledger, mergedIntake, enclosures);
}

export { inferAuthBranch, inferBundlingBranch, inferTimelyFilingBranch } from "./inferBranches";
