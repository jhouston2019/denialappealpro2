import { emptyLedger, setFact } from "../ledger/builder";
import type { FactKey, FactLedger } from "../ledger/types";

/** Actual Cigna EOB source fields (Phase 1.6 corrected fixture). */
export const CIGNA_RAW_DENIAL_TEXT = `
CIGNA HEALTH
P.O. Box 182223
Chattanooga, TN 37422

Member: James Whitfield
Member ID: CIG987654321
Group: Riverside Medical Group
Group #: 88231
Claim Number: CIG-2026-887731
Provider: Riverside Medical Group
Date of Service: 02/28/2026
Date Processed: 03/12/2026

CPT/HCPCS: 27130
CARC: CO-15
RARC: N517

Billed: $22,000.00
Allowed: $0.00
Paid: $0.00
Denied: $22,000.00
Timely filing: 180 days

Remark: The procedure/revenue code is inconsistent with the modifier used or a required modifier is missing.
Free-text examiner note: ICD-10 M16.11 was mentioned in the referral packet review.
`.trim();

function apply(
  ledger: FactLedger,
  entries: Array<[FactKey, string | string[]]>,
  provenance: "document" | "user"
): FactLedger {
  let L = ledger;
  for (const [key, value] of entries) {
    L = setFact(
      L,
      key,
      value,
      provenance,
      provenance === "document" ? `doc:cigna:p1:${key}` : `wizard:step3:${key}`,
      provenance === "document" ? 0.9 : 1
    );
  }
  return L;
}

const DOCUMENT_FACTS: Array<[FactKey, string | string[]]> = [
  ["claim.payerName", "Cigna Health"],
  ["claim.payerAppealAddress", "P.O. Box 182223, Chattanooga, TN 37422"],
  ["claim.number", "CIG-2026-887731"],
  ["claim.dateOfService", "2026-02-28"],
  ["claim.dateProcessed", "2026-03-12"],
  ["claim.cptCodes", ["27130"]],
  ["claim.icd10Codes", ["M16.11"]],
  ["claim.carcCodes", ["15"]],
  ["claim.rarcCodes", ["N517"]],
  ["claim.billedAmount", "22000.00"],
  ["claim.allowedAmount", "0.00"],
  ["claim.paidAmount", "0.00"],
  ["claim.deniedAmount", "22000.00"],
  ["claim.timelyFilingDays", "180"],
  ["patient.name", "James Whitfield"],
  ["patient.memberId", "CIG987654321"],
  ["patient.groupName", "Riverside Medical Group"],
  ["patient.groupNumber", "88231"],
];

/** Codes-only sparse ledger (adversarial case 1). */
export function cignaCodesOnlyLedger(): FactLedger {
  let L = emptyLedger(["cigna-cig-2026-887731"]);
  L = apply(
    L,
    [
      ["claim.number", "CIG-2026-887731"],
      ["claim.payerName", "Cigna Health"],
      ["claim.cptCodes", ["27130"]],
      ["claim.carcCodes", ["15"]],
      ["claim.rarcCodes", ["N517"]],
      ["claim.billedAmount", "22000.00"],
      ["claim.deniedAmount", "22000.00"],
    ],
    "document"
  );
  return {
    ...L,
    enclosures: L.enclosures.map((e) => ({ ...e, checked: false })),
  };
}

const PROVIDER_SIGNER: Array<[FactKey, string | string[]]> = [
  ["provider.name", "Riverside Medical Group"],
  ["provider.npi", "1568890123"],
  ["provider.addressBlock", "400 River Walk, Suite 200, Chattanooga, TN 37402"],
  ["provider.phone", "423-555-0144"],
  ["provider.fax", "423-555-0145"],
  ["signer.name", "Jordan Hale"],
  ["signer.title", "Appeals Coordinator"],
  ["signer.phone", "423-555-0144"],
  ["appeal.level", "First-level"],
];

/**
 * Letter (a) — placeholder demonstration.
 * Omits: provider.npi, signer.name, signer.title, patient.groupNumber.
 * No clinical input, no enclosures.
 */
export function cignaLetterALedger(): FactLedger {
  let L = emptyLedger(["cigna-letter-a"]);
  L = apply(L, DOCUMENT_FACTS, "document");
  // Clear group number deliberately
  L = {
    ...L,
    facts: { ...L.facts },
  };
  delete L.facts["patient.groupNumber"];
  L = apply(
    L,
    [
      ["provider.name", "Riverside Medical Group"],
      ["provider.addressBlock", "400 River Walk, Suite 200, Chattanooga, TN 37402"],
      ["provider.phone", "423-555-0144"],
      // omit provider.npi, signer.name, signer.title
    ],
    "user"
  );
  return {
    ...L,
    enclosures: L.enclosures.map((e) => ({ ...e, checked: false })),
  };
}

const CLINICAL_ALL: Array<[FactKey, string | string[]]> = [
  [
    "clinical.primaryDiagnosis",
    "Primary osteoarthritis of right hip, M16.11",
  ],
  [
    "clinical.conservativeCareTried",
    "Six months PT, intra-articular corticosteroid injection, NSAIDs",
  ],
  [
    "clinical.functionalImpact",
    "Unable to ambulate more than 50 feet without assistive device",
  ],
  [
    "clinical.indication",
    "End-stage degenerative joint disease of the right hip with refractory pain",
  ],
  [
    "clinical.priorTreatments",
    "Activity modification, assistive device trial, and supervised physical therapy",
  ],
];

/**
 * Letter (b) — fully populated: all required facts, five clinical.*, three enclosures.
 */
export function cignaLetterBLedger(): FactLedger {
  let L = emptyLedger(["cigna-letter-b"]);
  L = apply(L, DOCUMENT_FACTS, "document");
  L = apply(L, PROVIDER_SIGNER, "user");
  L = apply(L, CLINICAL_ALL, "user");
  L = apply(L, [
    ["patient.planType", "fully-insured-group"],
    ["appeal.authBranch", "D"],
  ], "user");
  const checked = new Set(["operative_report", "office_notes", "eob_copy"]);
  return {
    ...L,
    enclosures: L.enclosures.map((e) => ({
      ...e,
      checked: checked.has(e.id),
    })),
  };
}

/** Full clinical presence base (required facts + optional clinical overlay). */
export function cignaFullRequiredLedger(): FactLedger {
  let L = emptyLedger(["cigna-full"]);
  L = apply(L, DOCUMENT_FACTS, "document");
  L = apply(L, PROVIDER_SIGNER, "user");
  L = setFact(
    L,
    "patient.planType",
    "erisa-self-funded",
    "user",
    "wizard:step3:planType",
    1
  );
  return {
    ...L,
    enclosures: L.enclosures.map((e) => ({ ...e, checked: false })),
  };
}

export function cignaExtractionFields(): Record<string, unknown> {
  return {
    payer_name: "Cigna Health",
    payer_appeal_address: "P.O. Box 182223, Chattanooga, TN 37422",
    claim_number: "CIG-2026-887731",
    patient_name: "James Whitfield",
    member_id: "CIG987654321",
    group_name: "Riverside Medical Group",
    group_number: "88231",
    date_of_service: "2026-02-28",
    date_processed: "2026-03-12",
    cpt_codes: ["27130"],
    carc_codes: ["15"],
    rarc_codes: ["N517"],
    billed_amount: "22000.00",
    allowed_amount: "0.00",
    paid_amount: "0.00",
    denied_amount: "22000.00",
    timely_filing_days: "180",
    icd10_codes: ["M16.11"],
    icd_codes: ["M16.11"],
    denial_reason_text:
      "The procedure/revenue code is inconsistent with the modifier used or a required modifier is missing.",
  };
}

export { CLINICAL_ALL };
