export const LETTER_DISCLAIMER =
  "Denial Appeal Pro is not a law firm and does not provide legal advice. Generated letters are for administrative use only.";

const FULL_DISCLAIMER_RE =
  /Denial Appeal Pro is not a law firm and does not provide legal advice\. Generated letters are for administrative use only\./gi;

const PARTIAL_DISCLAIMER_RE =
  /\n*Denial Appeal Pro is not a law firm[\s\S]*$/i;

/** Remove copyright/build footer lines that must never appear in letters. */
const COPYRIGHT_BUILD_RE =
  /(?:^|\n)\s*©\s*\d{4}\s*Denial Appeal Pro[^\\n]*(?:Build\s*\d+[^\\n]*)?\s*/gi;

const BUILD_FOOTER_RE = /(?:^|\n)\s*Denial Appeal Pro · Build\s*\d+\s*\|?\s*/gi;

/** Strip disclaimer copies and copyright/build artifacts from letter text. */
export function stripLetterFooterArtifacts(text: string): string {
  let out = String(text || "");
  out = out.replace(COPYRIGHT_BUILD_RE, "\n");
  out = out.replace(BUILD_FOOTER_RE, "\n");
  out = out.replace(FULL_DISCLAIMER_RE, "");
  out = out.replace(PARTIAL_DISCLAIMER_RE, "");
  return out.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
}

/** Append the system disclaimer as the final line; strip any prior copies first. */
export function appendLetterDisclaimer(text: string): string {
  const withoutPartial = stripLetterFooterArtifacts(text);
  return `${withoutPartial}\n\n${LETTER_DISCLAIMER}`;
}

/** Idempotent — guarantees exactly one canonical disclaimer as the final line. */
export function ensureLetterDisclaimer(text: string): string {
  const cleaned = stripLetterFooterArtifacts(text);
  if (cleaned.endsWith(LETTER_DISCLAIMER)) {
    return cleaned;
  }
  return `${cleaned}\n\n${LETTER_DISCLAIMER}`;
}
