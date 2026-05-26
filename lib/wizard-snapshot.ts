import type { Json } from "@/types/database.types";

export const WIZARD_STATE_STORAGE_KEY = "erp_wizard_state" as const;
export const DELIVERABLES_REVIEW_ID_KEY = "erp_deliverables_review_id" as const;

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
