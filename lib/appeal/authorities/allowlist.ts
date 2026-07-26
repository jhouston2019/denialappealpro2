import { citationStringsFromRecords, allAuthorityRecords } from "./records";

/** Derived automatically from authority records — do not maintain separately. */
export const ALLOWED_CITATION_STRINGS: string[] = citationStringsFromRecords(
  allAuthorityRecords()
);
