import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import {
  CARC4_M144_BUNDLING_DESCRIPTOR,
  lookupCarc,
  normalizeCarcCode,
  type CarcEntry,
} from "./carc-table";

function parseCodes(value: FactValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when CARC CO-4 and RARC M144 indicate NCCI E/M bundling. */
export function isCarc4M144Bundling(ledger: FactLedger): boolean {
  const carcs = parseCodes(getValue(ledger, "claim.carcCodes")).map(normalizeCarcCode);
  const rarcs = parseCodes(getValue(ledger, "claim.rarcCodes")).map((c) =>
    c.toUpperCase()
  );
  return carcs.includes("4") && rarcs.includes("M144");
}

/** Override CARC entry for CO-4 + M144 bundling denials. */
export function carc4M144BundlingEntry(): CarcEntry {
  return {
    code: "4",
    descriptor: CARC4_M144_BUNDLING_DESCRIPTOR,
    strategyId: "bundling",
    primaryArgument:
      "The E/M service was a significant, separately identifiable evaluation and management service distinct from the procedure performed on the same date. Under CMS NCCI policy, modifier 25 exempts significant and separately identifiable E/M services from bundling edits.",
    isAdministrative: true,
    correctedClaimFirst: true,
  };
}
