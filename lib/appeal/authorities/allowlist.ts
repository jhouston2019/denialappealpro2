import { citationStringsFromRecords, allAuthorityRecords } from "./records";

/** Standard regulatory citations pre-approved for export validation. */
export const GLOBAL_PREAPPROVED_CITATIONS: string[] = [
  "29 U.S.C. § 1132(a)(1)(B)",
  "29 U.S.C. § 1133",
  "29 C.F.R. § 2560.503-1",
  "29 C.F.R. § 2560.503-1(g)",
  "29 C.F.R. § 2560.503-1(g)(1)(i)",
  "29 C.F.R. § 2560.503-1(h)(2)(iii)",
  "29 C.F.R. § 2560.503-1(i)",
  "29 C.F.R. § 2560.503-1(l)",
  "45 C.F.R. § 147.136",
  "42 U.S.C. § 300gg-19",
  "42 U.S.C. § 1395dd",
  "CMS NCCI Policy Manual",
  "NCCI Policy Manual",
  "EMTALA",
  "ERISA § 502(a)(1)(B)",
  "ERISA § 502",
  "Affordable Care Act",
];

/** Derived from authority records plus global pre-approved regulatory citations. */
export const ALLOWED_CITATION_STRINGS: string[] = [
  ...GLOBAL_PREAPPROVED_CITATIONS,
  ...citationStringsFromRecords(allAuthorityRecords()),
];
