/** Internal system terms that must never appear in payer-facing letter text. */
export const INTERNAL_LANGUAGE_TERMS: readonly string[] = [
  "fact ledger",
  "ledger",
  "dap_",
  "intake",
  "generatorPath",
  "assertLlmPath",
  "provenance",
];

/** Remove internal routing / system vocabulary from letter body (not the legal disclaimer). */
export function stripInternalLanguageFromLetter(text: string): string {
  let out = String(text || "");
  for (const term of INTERNAL_LANGUAGE_TERMS) {
    if (term.endsWith("_")) {
      out = out.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    } else {
      out = out.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "");
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
}
