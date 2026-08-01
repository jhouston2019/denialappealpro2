export const LETTER_DISCLAIMER =
  "Denial Appeal Pro is not a law firm and does not provide legal advice. Generated letters are for administrative use only.";

const PARTIAL_DISCLAIMER_RE =
  /\n*Denial Appeal Pro is not a law firm[\s\S]*$/i;

/** Append the system disclaimer as the final line; strip any partial model copy first. */
export function appendLetterDisclaimer(text: string): string {
  const withoutPartial = String(text || "")
    .replace(PARTIAL_DISCLAIMER_RE, "")
    .replace(/\s+$/, "");
  return `${withoutPartial}\n\n${LETTER_DISCLAIMER}`;
}
