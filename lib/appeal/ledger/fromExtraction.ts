import { sanitizeCarcDescription } from "../format/sanitizeCodes";
import { emptyLedger, setFact } from "./builder";
import { normalizeIcd10Array } from "../format/normalizeIcd10";
import {
  extractProviderNameFromRaw,
  sanitizeProviderName,
} from "./providerExtract";
import type { FactKey, FactLedger, FactValue } from "./types";

/** Closed set of non-clinical keys the extraction LLM may return. */
export const EXTRACTION_LEDGER_KEYS = [
  "claim.number",
  "claim.payerName",
  "provider.name",
  "claim.payerAppealAddress",
  "claim.dateOfService",
  "claim.dateProcessed",
  "claim.billedAmount",
  "claim.allowedAmount",
  "claim.paidAmount",
  "claim.deniedAmount",
  "claim.carcCodes",
  "claim.rarcCodes",
  "claim.cptCodes",
  "claim.icd10Codes",
  "claim.modifiers",
  "claim.timelyFilingDays",
  "claim.appealAddressBlock",
  "patient.name",
  "patient.memberId",
  "patient.groupName",
  "patient.groupNumber",
  "patient.dateOfBirth",
] as const satisfies readonly FactKey[];

export type ExtractionLedgerKey = (typeof EXTRACTION_LEDGER_KEYS)[number];

/** Snake_case keys returned by the extraction LLM (closed set). */
export type ExtractionLlmPayload = {
  claim_number: string | null;
  provider_name: string | null;
  payer_name: string | null;
  payer_appeal_address: string | null;
  date_of_service: string | null;
  date_processed: string | null;
  billed_amount: string | number | null;
  allowed_amount: string | number | null;
  paid_amount: string | number | null;
  denied_amount: string | number | null;
  carc_codes: string[] | null;
  rarc_codes: string[] | null;
  cpt_codes: string[] | null;
  modifiers: string[] | null;
  timely_filing_days: string | number | null;
  appeal_address_block: string | null;
  patient_name: string | null;
  member_id: string | null;
  group_name: string | null;
  group_number: string | null;
  date_of_birth: string | null;
  /** Not a FactKey — carried for Step 2 UI only. */
  denial_reason_text?: string | null;
  // Alias drift (normalized before ledger write)
  payer?: string | null;
  provider?: string | null;
  rendering_provider?: string | null;
  billing_provider?: string | null;
  patient?: string | null;
  member_name?: string | null;
  member?: string | null;
  insured_name?: string | null;
  subscriber_name?: string | null;
  icd_codes?: string[] | null;
  icd10_codes?: string[] | null;
};

const LLM_TO_FACT: Record<string, FactKey> = {
  claim_number: "claim.number",
  provider_name: "provider.name",
  payer_name: "claim.payerName",
  payer_appeal_address: "claim.payerAppealAddress",
  date_of_service: "claim.dateOfService",
  date_processed: "claim.dateProcessed",
  billed_amount: "claim.billedAmount",
  allowed_amount: "claim.allowedAmount",
  paid_amount: "claim.paidAmount",
  denied_amount: "claim.deniedAmount",
  carc_codes: "claim.carcCodes",
  rarc_codes: "claim.rarcCodes",
  cpt_codes: "claim.cptCodes",
  icd10_codes: "claim.icd10Codes",
  icd_codes: "claim.icd10Codes",
  modifiers: "claim.modifiers",
  timely_filing_days: "claim.timelyFilingDays",
  appeal_address_block: "claim.appealAddressBlock",
  patient_name: "patient.name",
  member_id: "patient.memberId",
  group_name: "patient.groupName",
  group_number: "patient.groupNumber",
  date_of_birth: "patient.dateOfBirth",
};

function verbatimInRaw(val: unknown, raw: string): boolean {
  if (val == null || val === "" || !raw) return false;
  return raw.toLowerCase().includes(String(val).toLowerCase());
}

function numericConfidence(val: FactValue, raw: string): number {
  if (val == null) return 0;
  if (Array.isArray(val)) {
    if (!val.length) return 0;
    const hits = val.filter((x) => verbatimInRaw(x, raw)).length;
    return hits / val.length;
  }
  if (verbatimInRaw(val, raw)) return 0.95;
  if (typeof val === "string" && val.trim()) return 0.35;
  if (typeof val === "number" && Number.isFinite(val)) return 0.35;
  return 0;
}

function toFactValue(val: unknown, asArray: boolean, llmKey?: string): FactValue {
  if (val == null || val === "") return null;
  if (asArray) {
    if (Array.isArray(val)) {
      const arr = val.map((x) => String(x).trim()).filter(Boolean);
      const normalized =
        llmKey === "icd10_codes" || llmKey === "icd_codes"
          ? normalizeIcd10Array(arr)
          : arr;
      return normalized.length ? normalized : null;
    }
    const s = String(val).trim();
    if (!s) return null;
    const split = s
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const normalized =
      llmKey === "icd10_codes" || llmKey === "icd_codes"
        ? normalizeIcd10Array(split)
        : split;
    return normalized.length ? normalized : null;
  }
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const s = String(val).trim();
  return s || null;
}

/**
 * Build a FactLedger from normalized extraction fields.
 * Never writes clinical.*. Null for anything not present.
 */
export function buildLedgerFromExtraction(opts: {
  fields: Record<string, unknown>;
  rawText: string;
  documentId?: string;
}): { ledger: FactLedger; denialReasonText: string | null } {
  const { fields, rawText, documentId = "upload" } = opts;
  let ledger = emptyLedger([documentId]);

  const arrayKeys = new Set([
    "carc_codes",
    "rarc_codes",
    "cpt_codes",
    "icd10_codes",
    "icd_codes",
    "modifiers",
  ]);

  for (const [llmKey, factKey] of Object.entries(LLM_TO_FACT)) {
    const rawVal = fields[llmKey];
    const value = toFactValue(rawVal, arrayKeys.has(llmKey), llmKey);
    const confidence = numericConfidence(value, rawText);
    const sourceRef = `doc:${documentId}:p1:${llmKey}`;
    ledger = setFact(ledger, factKey, value, "document", sourceRef, confidence);
  }

  const payerName = String(fields.payer_name ?? "").trim();
  let providerName = sanitizeProviderName(
    fields.provider_name != null ? String(fields.provider_name) : null,
    payerName || null
  );
  if (!providerName) {
    providerName = extractProviderNameFromRaw(rawText);
  }
  if (providerName) {
    const confidence = numericConfidence(providerName, rawText);
    ledger = setFact(
      ledger,
      "provider.name",
      providerName,
      "document",
      `doc:${documentId}:p1:provider_name`,
      confidence
    );
  }

  // Derive denied amount when billed and paid are present and denied is null.
  const denied = ledger.facts["claim.deniedAmount"]?.value;
  const billed = ledger.facts["claim.billedAmount"]?.value;
  const paid = ledger.facts["claim.paidAmount"]?.value;
  if (
    (denied == null || denied === "") &&
    billed != null &&
    billed !== "" &&
    paid != null &&
    paid !== ""
  ) {
    const b = parseFloat(String(billed).replace(/[$,\s]/g, ""));
    const p = parseFloat(String(paid).replace(/[$,\s]/g, ""));
    if (Number.isFinite(b) && Number.isFinite(p)) {
      const d = Math.max(0, b - p).toFixed(2);
      ledger = setFact(
        ledger,
        "claim.deniedAmount",
        d,
        "derived",
        "derived:billed_amount-paid_amount",
        1
      );
    }
  }

  const rawDenialReason =
    fields.denial_reason_text != null && String(fields.denial_reason_text).trim()
      ? String(fields.denial_reason_text).trim()
      : "";
  const denialReasonText = rawDenialReason
    ? sanitizeCarcDescription(rawDenialReason)
    : null;

  return { ledger, denialReasonText };
}
