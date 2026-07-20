import type { Json } from "@/types/database.types";

/** Session keys for wizard resume / deliverables (shared with legacy ERP deliverables helpers). */
export const WIZARD_STATE_STORAGE_KEY = "dap_wizard_state" as const;
export const DELIVERABLES_REVIEW_ID_KEY = "erp_deliverables_review_id" as const;
/** Set after Stripe success so /upload can skip the usage wall for this session only. DAP2 wizard uses `dap_wizard_state` / `dap_wizard_resume` in `@/lib/dap-wizard-snapshot`. */
export const PAID_RESUME_SESSION_KEY = "erp_paid_resume" as const;
/** Checkout from pricing / buy-another — not a preview-unlock resume. */
export const NEW_REVIEW_CHECKOUT_KEY = "erp_new_review_checkout" as const;
export const NEW_REVIEW_PLAN_KEY = "erp_new_review_plan" as const;

/** Paid wizard URL that clears prior session and starts blank Step 1. */
export const UPLOAD_NEW_REVIEW_HREF = "/upload?new=1" as const;

export type SerializableWizardV1 = {
  v: 1;
  currentStep: number;
  documents: unknown;
  claimMeta: unknown;
  analyses: unknown;
  comparisons: unknown;
  strategies: unknown;
  letterType: string | null;
  letterRaw: string | null;
  letterPlaceholders: unknown;
  prefillApplied: boolean;
  summary: unknown;
};

export function tryParseWizardSnapshot(
  raw: string | null
): SerializableWizardV1 | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (typeof j !== "object" || j === null) return null;
    const o = j as { v?: number; currentStep?: number };
    if (o.v !== 1) return null;
    if (typeof o.currentStep !== "number" || o.currentStep < 1) return null;
    return j as SerializableWizardV1;
  } catch {
    return null;
  }
}

export function toSupabaseJsonValue(value: unknown): Json | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

/** Persist wizard state so /upload can resume this review (not a fresh preview). */
export function writeWizardResumeSnapshot(
  snap: SerializableWizardV1,
  reviewId?: string | null
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WIZARD_STATE_STORAGE_KEY, JSON.stringify(snap));
  window.sessionStorage.setItem(PAID_RESUME_SESSION_KEY, "true");
  if (reviewId?.trim()) {
    window.sessionStorage.setItem(DELIVERABLES_REVIEW_ID_KEY, reviewId.trim());
  }
}

/** Drop prior review resume data so a new purchase starts fresh. */
export function clearCompletedReviewSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(WIZARD_STATE_STORAGE_KEY);
  window.sessionStorage.removeItem(DELIVERABLES_REVIEW_ID_KEY);
  window.sessionStorage.removeItem(PAID_RESUME_SESSION_KEY);
  window.sessionStorage.removeItem("erp_resume");
  window.sessionStorage.removeItem("erp_extracted_text");
}

/** Call before Stripe checkout when buying a new review (not preview unlock). */
export function markNewReviewCheckout(planType: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(NEW_REVIEW_CHECKOUT_KEY, "true");
  window.sessionStorage.setItem(NEW_REVIEW_PLAN_KEY, planType);
}
