import type { FactLedger } from "@/lib/appeal/ledger/types";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

export const DAP_WIZARD_STATE_KEY = "dap_wizard_state" as const;
export const DAP_WIZARD_RESUME_KEY = "dap_wizard_resume" as const;
/** Set before Stripe checkout when the user must resume generation after payment. */
export const DAP_RESUME_AFTER_PAYMENT_KEY = "dap_resume_after_payment" as const;

export type FieldConfidence = "high" | "low";

export type DapConfidenceMap = {
  patientName: FieldConfidence;
  memberId: FieldConfidence;
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
  deniedAmount: FieldConfidence;
  cptCodes: FieldConfidence;
  icd10Codes: FieldConfidence;
};

export type DapWizardStrategySnapshot = {
  id: string;
  branch?: string | null;
};

export type DapWizardSnapshot = {
  v: 1;
  currentStep: number;
  intake: DenialIntake;
  confidence: DapConfidenceMap;
  ledger?: FactLedger | null;
  uploadedFileName?: string | null;
  extractedText?: string | null;
  claimNumber?: string | null;
  strategy?: DapWizardStrategySnapshot | null;
  timestamp?: number;
};

export function emptyConfidence(): DapConfidenceMap {
  return {
    patientName: "low",
    memberId: "low",
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
    deniedAmount: "low",
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

/** Persist full wizard snapshot to localStorage before Stripe redirect. */
export function writeDapWizardResume(snap: DapWizardSnapshot): void {
  if (typeof window === "undefined") return;
  const payload: DapWizardSnapshot = {
    ...snap,
    claimNumber: snap.claimNumber ?? snap.intake.claimNumber ?? null,
    timestamp: snap.timestamp ?? Date.now(),
  };
  const serialized = JSON.stringify(payload);
  window.localStorage.setItem(DAP_WIZARD_RESUME_KEY, serialized);
  window.localStorage.setItem(DAP_RESUME_AFTER_PAYMENT_KEY, "true");
  window.sessionStorage.setItem(DAP_WIZARD_STATE_KEY, serialized);
}

/** Mark checkout as a wizard resume (not a fresh "buy another" purchase). */
export function markWizardResumeCheckout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAP_RESUME_AFTER_PAYMENT_KEY, "true");
}

export function hasPendingWizardResumeCheckout(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(DAP_RESUME_AFTER_PAYMENT_KEY) === "true") {
    return true;
  }
  if (window.sessionStorage.getItem(DAP_RESUME_AFTER_PAYMENT_KEY) === "true") {
    return true;
  }
  return readDapWizardResume() != null;
}

export function clearWizardResumeCheckoutFlags(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DAP_RESUME_AFTER_PAYMENT_KEY);
  window.localStorage.removeItem(DAP_WIZARD_RESUME_KEY);
  window.sessionStorage.removeItem(DAP_RESUME_AFTER_PAYMENT_KEY);
  window.sessionStorage.removeItem(DAP_WIZARD_RESUME_KEY);
}

export function readDapWizardResume(): DapWizardSnapshot | null {
  if (typeof window === "undefined") return null;
  const fromLocal = tryParseDapWizardSnapshot(
    window.localStorage.getItem(DAP_WIZARD_RESUME_KEY)
  );
  if (fromLocal) return fromLocal;
  return tryParseDapWizardSnapshot(
    window.sessionStorage.getItem(DAP_WIZARD_RESUME_KEY)
  );
}
