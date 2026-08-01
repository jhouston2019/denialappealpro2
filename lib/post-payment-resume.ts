import { DEFAULT_ENCLOSURES } from "@/lib/appeal/ledger/keys";
import type { EnclosureItem } from "@/lib/appeal/ledger/types";
import { ensureLedgerWithStrategyBranches } from "@/lib/appeal/router/resolveStrategyBranches";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { wizardFetch } from "@/lib/supabaseClient";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import {
  clearWizardResumeCheckoutFlags,
  DAP_RESUME_AFTER_PAYMENT_KEY,
  DAP_WIZARD_RESUME_KEY,
  readDapWizardResume,
  tryParseDapWizardSnapshot,
  type DapWizardSnapshot,
} from "@/lib/dap-wizard-snapshot";
import { DELIVERABLES_REVIEW_ID_KEY } from "@/lib/wizard-snapshot";

function defaultEnclosures(): EnclosureItem[] {
  return DEFAULT_ENCLOSURES.map((e) => ({
    id: e.id,
    label: e.label,
    checked: false,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll billing status until paid access is confirmed (webhook latency). */
export async function waitForPaidAccess(
  maxMs = 10_000,
  intervalMs = 2_000
): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("/api/billing/status", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { hasPaidAccess?: boolean };
        if (data.hasPaidAccess === true) return true;
      }
    } catch {
      // retry until timeout
    }
    await sleep(intervalMs);
  }
  return false;
}

export function hasResumeAfterPaymentFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(DAP_RESUME_AFTER_PAYMENT_KEY) === "true") {
    return true;
  }
  // One-release fallback for in-flight checkouts written before localStorage migration.
  return window.sessionStorage.getItem(DAP_RESUME_AFTER_PAYMENT_KEY) === "true";
}

export function readWizardResumeFromStorage(): DapWizardSnapshot | null {
  if (typeof window === "undefined") return null;
  const fromLocal = tryParseDapWizardSnapshot(
    window.localStorage.getItem(DAP_WIZARD_RESUME_KEY)
  );
  if (fromLocal) return fromLocal;
  return readDapWizardResume();
}

export function clearPostPaymentResumeStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DAP_RESUME_AFTER_PAYMENT_KEY);
  window.localStorage.removeItem(DAP_WIZARD_RESUME_KEY);
  clearWizardResumeCheckoutFlags();
  window.sessionStorage.removeItem(DAP_RESUME_AFTER_PAYMENT_KEY);
  window.sessionStorage.removeItem(DAP_WIZARD_RESUME_KEY);
}

export async function generateAppealFromWizardSnapshot(
  snap: DapWizardSnapshot
): Promise<{ reviewId: string }> {
  const intake: DenialIntake = snap.intake;
  const enclosures = snap.ledger?.enclosures?.length
    ? snap.ledger.enclosures
    : defaultEnclosures();
  const factLedger = ensureLedgerWithStrategyBranches(
    snap.ledger,
    intake,
    enclosures
  );

  const body = {
    ledger: factLedger,
    patientName: intake.patientName,
    providerName: intake.providerName,
    providerNpi: intake.providerNpi,
    payerName: intake.payer,
    claimNumber: intake.claimNumber,
    dateOfService: intake.dateOfService,
    denialReason: intake.denialReason,
    carcCodes: intake.carcCodes,
    rarcCodes: intake.rarcCodes,
    billedAmount: intake.billedAmount,
    paidAmount: intake.paidAmount,
    deniedAmount: intake.deniedAmount,
    icd10Codes: intake.icdCodes,
    cptCodes: intake.cptCodes,
    additionalContext: intake.additionalContext,
    providerAddress: intake.providerAddress,
    providerPhone: intake.providerPhone,
    providerFax: intake.providerFax,
    memberId: intake.memberId,
    signerName: intake.signerName,
    signerTitle: intake.signerTitle,
  };

  const res = await wizardFetch(netlifyFunctionUrl("generate-appeal"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    success?: boolean;
    reviewId?: string;
    error?: string;
  };

  if (!res.ok || !data.success || !data.reviewId) {
    throw new Error(data.error?.trim() || "Appeal generation failed.");
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(DELIVERABLES_REVIEW_ID_KEY, data.reviewId);
  }

  return { reviewId: data.reviewId };
}
