import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

export const DAP_WIZARD_STATE_KEY = "dap_wizard_state" as const;
export const DAP_WIZARD_RESUME_KEY = "dap_wizard_resume" as const;

export type FieldConfidence = "high" | "low";

export type DapConfidenceMap = {
  patientName: FieldConfidence;
  providerName: FieldConfidence;
  providerNpi: FieldConfidence;
  payerName: FieldConfidence;
  claimNumber: FieldConfidence;
  dateOfService: FieldConfidence;
  denialReason: FieldConfidence;
  carcCodes: FieldConfidence;
  rarcCodes: FieldConfidence;
  billedAmount: FieldConfidence;
  paidAmount: FieldConfidence;
  cptCodes: FieldConfidence;
  icd10Codes: FieldConfidence;
};

export type DapWizardSnapshot = {
  v: 1;
  currentStep: number;
  intake: DenialIntake;
  confidence: DapConfidenceMap;
  uploadedFileName?: string | null;
};

export function emptyConfidence(): DapConfidenceMap {
  return {
    patientName: "low",
    providerName: "low",
    providerNpi: "low",
    payerName: "low",
    claimNumber: "low",
    dateOfService: "low",
    denialReason: "low",
    carcCodes: "low",
    rarcCodes: "low",
    billedAmount: "low",
    paidAmount: "low",
    cptCodes: "low",
    icd10Codes: "low",
  };
}

export function tryParseDapWizardSnapshot(
  raw: string | null
): DapWizardSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (typeof j !== "object" || j === null) return null;
    const o = j as { v?: number; currentStep?: number; intake?: unknown };
    if (o.v !== 1) return null;
    if (typeof o.currentStep !== "number" || o.currentStep < 1) return null;
    if (!o.intake || typeof o.intake !== "object") return null;
    return j as DapWizardSnapshot;
  } catch {
    return null;
  }
}

export function writeDapWizardState(snap: DapWizardSnapshot): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DAP_WIZARD_STATE_KEY, JSON.stringify(snap));
}

export function writeDapWizardResume(snap: DapWizardSnapshot): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DAP_WIZARD_RESUME_KEY, JSON.stringify(snap));
  window.sessionStorage.setItem(DAP_WIZARD_STATE_KEY, JSON.stringify(snap));
}

export function readDapWizardResume(): DapWizardSnapshot | null {
  if (typeof window === "undefined") return null;
  return tryParseDapWizardSnapshot(
    window.sessionStorage.getItem(DAP_WIZARD_RESUME_KEY)
  );
}
