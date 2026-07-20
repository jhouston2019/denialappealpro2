import {
  emptyIntake,
  normalizeIcdCodesFromExtract,
  type DenialIntake,
} from "@/lib/wizard/denialIntakeEngine";
import {
  emptyConfidence,
  type DapConfidenceMap,
  type FieldConfidence,
} from "@/lib/dap-wizard-snapshot";

export type ExtractDenialResponse = {
  success?: boolean;
  patientName?: string;
  patientNameConfidence?: FieldConfidence;
  providerName?: string;
  providerNameConfidence?: FieldConfidence;
  providerNpi?: string;
  providerNpiConfidence?: FieldConfidence;
  payerName?: string;
  payerNameConfidence?: FieldConfidence;
  claimNumber?: string;
  claimNumberConfidence?: FieldConfidence;
  dateOfService?: string;
  dateOfServiceConfidence?: FieldConfidence;
  denialReason?: string;
  denialReasonConfidence?: FieldConfidence;
  carcCodes?: string[];
  carcCodesConfidence?: FieldConfidence;
  rarcCodes?: string[];
  rarcCodesConfidence?: FieldConfidence;
  billedAmount?: string;
  billedAmountConfidence?: FieldConfidence;
  paidAmount?: string;
  paidAmountConfidence?: FieldConfidence;
  cptCodes?: string[];
  cptCodesConfidence?: FieldConfidence;
  icd10Codes?: string[];
  icd10CodesConfidence?: FieldConfidence;
  error?: string;
  message?: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function conf(v: unknown, fallback: FieldConfidence = "low"): FieldConfidence {
  return v === "high" ? "high" : fallback;
}

export function mapExtractedToIntake(payload: ExtractDenialResponse): {
  intake: DenialIntake;
  confidence: DapConfidenceMap;
} {
  const base = emptyIntake();
  const confidence = emptyConfidence();

  const icdFromLegacy = normalizeIcdCodesFromExtract(
    payload as unknown as Record<string, unknown>
  );

  const intake: DenialIntake = {
    ...base,
    patientName: str(payload.patientName),
    providerName: str(payload.providerName),
    providerNpi: str(payload.providerNpi),
    payer: str(payload.payerName),
    claimNumber: str(payload.claimNumber),
    dateOfService: str(payload.dateOfService),
    denialReason: str(payload.denialReason),
    carcCodes: arr(payload.carcCodes),
    rarcCodes: arr(payload.rarcCodes),
    cptCodes: arr(payload.cptCodes),
    icdCodes:
      arr(payload.icd10Codes).length > 0
        ? arr(payload.icd10Codes)
        : icdFromLegacy,
    billedAmount: str(payload.billedAmount),
    paidAmount: str(payload.paidAmount),
  };

  confidence.patientName = conf(payload.patientNameConfidence);
  confidence.providerName = conf(payload.providerNameConfidence);
  confidence.providerNpi = conf(payload.providerNpiConfidence);
  confidence.payerName = conf(payload.payerNameConfidence);
  confidence.claimNumber = conf(payload.claimNumberConfidence);
  confidence.dateOfService = conf(payload.dateOfServiceConfidence);
  confidence.denialReason = conf(payload.denialReasonConfidence);
  confidence.carcCodes = conf(payload.carcCodesConfidence);
  confidence.rarcCodes = conf(payload.rarcCodesConfidence);
  confidence.billedAmount = conf(payload.billedAmountConfidence);
  confidence.paidAmount = conf(payload.paidAmountConfidence);
  confidence.cptCodes = conf(payload.cptCodesConfidence);
  confidence.icd10Codes = conf(payload.icd10CodesConfidence);

  return { intake, confidence };
}
