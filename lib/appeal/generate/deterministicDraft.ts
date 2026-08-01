import { getValue, missingRequired } from "../ledger/builder";
import { FACT_LABELS } from "../ledger/keys";
import type { FactKey, FactLedger, FactValue } from "../ledger/types";
import {
  formatCurrency,
  formatLetterDate,
} from "../format/render";
import { getAuthoritiesForLedger } from "../authorities/gate";
import { assembleLetter } from "../letter/assembler";
import { resolveIcd10CodesForLetter } from "../format/icd10ForLetter";
import { routeDenial } from "../router/index";
import type { GenerationResult } from "./types";

function arr(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmt(v: FactValue | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v);
}

function req(key: FactKey): string {
  return `[[REQUIRED: ${key} — ${FACT_LABELS[key]}]]`;
}

function valOrRequired(ledger: FactLedger, key: FactKey): string {
  const v = getValue(ledger, key);
  if (valueEmpty(v as FactValue)) return req(key);
  return fmt(v);
}

function valueEmpty(v: FactValue): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return !v.length;
  return false;
}

/**
 * Deterministic grounded draft — never used for grounding proof tests.
 * Sets generatorPath: 'deterministic'.
 */
export function deterministicGroundedDraft(ledger: FactLedger): GenerationResult {
  const missing = missingRequired(ledger);
  const route = routeDenial(ledger);
  const claim = valOrRequired(ledger, "claim.number");
  const dosRaw = getValue(ledger, "claim.dateOfService");
  const dos = !valueEmpty(dosRaw as FactValue)
    ? formatLetterDate(String(dosRaw))
    : req("claim.dateOfService");
  const cpt = valOrRequired(ledger, "claim.cptCodes");
  const icdCodes = resolveIcd10CodesForLetter(ledger);
  const icdPart = icdCodes.join(", ");
  const diagnosis = fmt(getValue(ledger, "clinical.primaryDiagnosis"));
  const icdPhrase = icdPart
    ? diagnosis
      ? `ICD-10: ${icdPart} — ${diagnosis}`
      : `ICD-10: ${icdPart}`
    : "";
  const billed =
    formatCurrency(fmt(getValue(ledger, "claim.billedAmount"))) ||
    req("claim.billedAmount");
  const denied =
    formatCurrency(fmt(getValue(ledger, "claim.deniedAmount"))) ||
    req("claim.deniedAmount");
  const descriptor =
    route.primaryCarc?.descriptor ??
    "Payment adjusted per the cited reason code.";

  const relief = `We request reversal of the denial and payment for claim ${claim} at the contracted rate.`;

  const claimSummary = [
    `Claim ${claim} was submitted for services rendered on ${dos}. CPT ${cpt}.`,
    icdPhrase,
    `The billed amount is ${billed}; the denied amount is ${denied}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const denialBasis = `The payer denied this claim citing: ${descriptor}.`;

  const strategyArg = route.strategy.leadArgument;

  const narrativeParts = [relief, claimSummary, denialBasis, strategyArg];
  if (missing.length) {
    narrativeParts.push(missing.map((k) => req(k)).join(" "));
  }

  const narrative = narrativeParts.join("\n\n");
  const authorities = getAuthoritiesForLedger(ledger);
  const text = assembleLetter(ledger, narrative, authorities);

  return { text, generatorPath: "deterministic", ledger };
}
