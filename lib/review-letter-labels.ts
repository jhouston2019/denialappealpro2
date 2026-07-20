const LETTER_TYPE_LABELS: Record<string, string> = {
  SUPPLEMENT_DEMAND: "Supplement demand",
  APPEAL: "Appeal letter",
  DISPUTE: "Dispute letter",
  REINSPECTION_REQUEST: "Reinspection request",
  APPRAISAL_INVOCATION: "Appraisal invocation",
  CUSTOM: "Custom letter",
  CUSTOM_NARRATIVE: "Custom narrative",
};

export function labelForStoredLetterType(code: string | null | undefined): string {
  if (!code?.trim()) return "—";
  return LETTER_TYPE_LABELS[code.trim()] ?? code.trim();
}
