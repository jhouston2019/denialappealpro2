import {
  letterPlaceholdersFromClaimMeta,
  type ClaimMetaSlice,
  type LetterPlaceholderFields,
} from "@/lib/estimate-letter-placeholders";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function pickStr(
  r: Record<string, unknown> | undefined,
  ...keys: string[]
): string {
  if (!r) return "";
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function firstNonEmpty(
  ...vals: (string | null | undefined)[]
): string {
  for (const v of vals) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Resolves [CLAIM NUMBER], [POLICY NUMBER], [DATE OF LOSS], etc. from all common
 * shapes: top-level on analysis, wizard `claimMeta`, `property_details` (snake_case),
 * and optional summary JSON.
 */
export function buildPlaceholderFieldsFromStoredJson(
  insuredName: string | null | undefined,
  analysis: unknown,
  summaryJson?: unknown
): LetterPlaceholderFields {
  const a = isRecord(analysis) ? analysis : undefined;
  const s = isRecord(summaryJson) ? summaryJson : undefined;
  const pd = a && isRecord(a.property_details) ? a.property_details : undefined;
  const cm = a && isRecord(a.claimMeta) ? a.claimMeta : undefined;
  const sPd = s && isRecord(s.property_details) ? s.property_details : undefined;
  const sCm = s && isRecord(s.claimMeta) ? s.claimMeta : undefined;

  const meta: ClaimMetaSlice = {
    insuredName: firstNonEmpty(
      insuredName,
      pickStr(cm, "insuredName", "insured_name"),
      pickStr(sCm, "insuredName", "insured_name"),
      pickStr(a, "insuredName", "insured_name"),
      pickStr(s, "insuredName", "insured_name")
    ),
    carrierName:
      firstNonEmpty(
        pickStr(cm, "carrierName", "carrier_name"),
        pickStr(sCm, "carrierName", "carrier_name"),
        pickStr(a, "carrierName", "carrier_name"),
        pickStr(s, "carrierName", "carrier_name")
      ) || undefined,
    policyNumber: firstNonEmpty(
      pickStr(cm, "policyNumber", "policy_number"),
      pickStr(sCm, "policyNumber", "policy_number"),
      pickStr(a, "policyNumber", "policy_number"),
      pickStr(s, "policyNumber", "policy_number"),
      pickStr(pd, "policyNumber", "policy_number"),
      pickStr(sPd, "policyNumber", "policy_number")
    ),
    claimNumber: firstNonEmpty(
      pickStr(cm, "claimNumber", "claim_number"),
      pickStr(sCm, "claimNumber", "claim_number"),
      pickStr(a, "claimNumber", "claim_number"),
      pickStr(s, "claimNumber", "claim_number"),
      pickStr(pd, "claimNumber", "claim_number"),
      pickStr(sPd, "claimNumber", "claim_number")
    ),
    dateOfLoss: firstNonEmpty(
      pickStr(cm, "dateOfLoss", "date_of_loss"),
      pickStr(sCm, "dateOfLoss", "date_of_loss"),
      pickStr(a, "dateOfLoss", "date_of_loss"),
      pickStr(s, "dateOfLoss", "date_of_loss"),
      pickStr(pd, "dateOfLoss", "date_of_loss"),
      pickStr(sPd, "dateOfLoss", "date_of_loss")
    ),
    adjusterName: firstNonEmpty(
      pickStr(cm, "adjusterName", "adjuster_name"),
      pickStr(sCm, "adjusterName", "adjuster_name"),
      pickStr(a, "adjusterName", "adjuster_name", "adjuster"),
      pickStr(s, "adjusterName", "adjuster_name", "adjuster"),
      pickStr(pd, "adjusterName", "adjuster", "adjuster_name"),
      pickStr(sPd, "adjusterName", "adjuster", "adjuster_name")
    ),
    responseDeadline: firstNonEmpty(
      pickStr(cm, "responseDeadline", "response_deadline"),
      pickStr(sCm, "responseDeadline", "response_deadline"),
      pickStr(a, "responseDeadline", "response_deadline"),
      pickStr(s, "responseDeadline", "response_deadline")
    ),
  };
  const base = letterPlaceholdersFromClaimMeta(meta);
  const amount = firstNonEmpty(
    pickStr(a, "disputedAmount", "disputed_amount", "amount"),
    pickStr(s, "disputedAmount", "disputed_amount", "amount"),
    base.amount
  );
  return { ...base, amount };
}
