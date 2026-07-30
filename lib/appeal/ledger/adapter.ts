import type { FieldConfidence } from "@/lib/dap-wizard-snapshot";
import type { ExtractDenialResponse } from "@/lib/wizard/mapExtractedToIntake";
import { getValue } from "./builder";
import type { FactLedger, FactValue } from "./types";

function asString(v: FactValue | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v);
}

function asArray(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v).trim();
  return s ? [s] : [];
}

function confFromNumber(n: number | undefined): FieldConfidence {
  if (n == null) return "low";
  return n >= 0.5 ? "high" : "low";
}

/**
 * Thin adapter so existing wizard consumers keep working during Phase 1.
 * Maps FactLedger → legacy ExtractDenialResponse shape (camelCase + *Confidence).
 */
export function ledgerToLegacyShape(ledger: FactLedger): ExtractDenialResponse {
  const factConf = (key: Parameters<typeof getValue>[1]): FieldConfidence =>
    confFromNumber(ledger.facts[key]?.confidence);

  const denied = getValue(ledger, "claim.deniedAmount");
  const billed = getValue(ledger, "claim.billedAmount");
  const paid = getValue(ledger, "claim.paidAmount");

  return {
    success: true,
    patientName: asString(getValue(ledger, "patient.name")),
    patientNameConfidence: factConf("patient.name"),
    providerName: asString(getValue(ledger, "provider.name")),
    providerNameConfidence: factConf("provider.name"),
    providerNpi: asString(getValue(ledger, "provider.npi")),
    providerNpiConfidence: factConf("provider.npi"),
    payerName: asString(getValue(ledger, "claim.payerName")),
    payerNameConfidence: factConf("claim.payerName"),
    claimNumber: asString(getValue(ledger, "claim.number")),
    claimNumberConfidence: factConf("claim.number"),
    dateOfService: asString(getValue(ledger, "claim.dateOfService")),
    dateOfServiceConfidence: factConf("claim.dateOfService"),
    // Denial reason is not a FactKey; preserved separately when present on response.
    denialReason: "",
    denialReasonConfidence: "low",
    carcCodes: asArray(getValue(ledger, "claim.carcCodes")),
    carcCodesConfidence: factConf("claim.carcCodes"),
    rarcCodes: asArray(getValue(ledger, "claim.rarcCodes")),
    rarcCodesConfidence: factConf("claim.rarcCodes"),
    billedAmount: asString(billed),
    billedAmountConfidence: factConf("claim.billedAmount"),
    paidAmount: asString(paid ?? denied),
    paidAmountConfidence: factConf("claim.paidAmount"),
    cptCodes: asArray(getValue(ledger, "claim.cptCodes")),
    cptCodesConfidence: factConf("claim.cptCodes"),
    // ICD-10 codes from claim-level extraction (document) or user confirmation.
    icd10Codes: asArray(getValue(ledger, "claim.icd10Codes")).length
      ? asArray(getValue(ledger, "claim.icd10Codes"))
      : asArray(getValue(ledger, "clinical.icd10Codes")),
    icd10CodesConfidence: factConf("claim.icd10Codes") !== "low"
      ? factConf("claim.icd10Codes")
      : factConf("clinical.icd10Codes"),
    memberId: asString(getValue(ledger, "patient.memberId")),
    memberIdConfidence: factConf("patient.memberId"),
    deniedAmount: asString(denied),
    deniedAmountConfidence: factConf("claim.deniedAmount"),
    modifiers: asArray(getValue(ledger, "claim.modifiers")),
    modifiersConfidence: factConf("claim.modifiers"),
  };
}

/** Attach denial reason text onto a legacy payload (not a FactKey). */
export function withDenialReason(
  legacy: ExtractDenialResponse,
  denialReason: string | null | undefined,
  confidence: FieldConfidence = "low"
): ExtractDenialResponse {
  const text = denialReason?.trim() || "";
  return {
    ...legacy,
    denialReason: text,
    denialReasonConfidence: text ? confidence : "low",
  };
}
