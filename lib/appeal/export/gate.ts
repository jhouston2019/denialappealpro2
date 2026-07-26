import { isFactLedger } from "../ledger/guard";
import type { FactLedger } from "../ledger/types";
import {
  validateLetter,
  type ValidationError,
} from "../validate/index";

/**
 * Shared export gate for PDF and DOCX.
 * Always returns a ValidationError[] — empty means export allowed.
 */
export function evaluateExportGate(
  letterText: string,
  ledger?: FactLedger | null
): ValidationError[] {
  const text = String(letterText || "");

  if (ledger && isFactLedger(ledger)) {
    return validateLetter(text, ledger).filter((e) => e.severity !== "warning");
  }

  // Without a ledger, still block unresolved placeholders.
  const placeholders = text.match(/\[\[REQUIRED:[^\]]+\]\]/g) || [];
  return placeholders.map((token) => ({
    rule: "no_unresolved_placeholders",
    message: `Unresolved required fact placeholder: ${token}`,
    wizardStep: 3 as const,
  }));
}

export function exportBlockedPayload(errors: ValidationError[]) {
  return {
    error: "Letter failed grounding validation and cannot be exported",
    errors,
    details: errors.map((e) => e.message).join("; "),
    code: "EXPORT_BLOCKED" as const,
  };
}
