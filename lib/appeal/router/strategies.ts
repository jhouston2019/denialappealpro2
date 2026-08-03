import type { FactKey } from "../ledger/types";

export type StrategyId =
  | "authorization"
  | "claim-defect"
  | "duplicate"
  | "timely-filing"
  | "contractual"
  | "medical-necessity"
  | "experimental"
  | "not-proven"
  | "non-covered"
  | "bundling"
  | "dx-not-covered"
  | "not-covered-benefit"
  | "wrong-payer"
  | "unknown";

export type SectionId =
  | "relief-requested"
  | "claim-summary"
  | "denial-basis"
  | "authorization-status"
  | "administrative-argument"
  | "clinical-argument"
  | "authority-sections"
  | "bundling-argument"
  | "timely-filing-argument"
  | "procedural-obligations"
  | "escalation"
  | "signature";

export type AuthBranchId = "A" | "B" | "C" | "D";

export type BundlingBranchId =
  | "modifier-25"
  | "modifier-59"
  | "no-ncci-edit"
  | "modifier-indicator-0";

export type TimelyFilingBranchId =
  | "proof-of-timely-submission"
  | "coordination-of-benefits"
  | "good-cause"
  | "plan-error";

export type ClaimDefectBranchId =
  | "missing-info"
  | "invalid-info"
  | "duplicate-submission-flag";

export type NonCoveredBranchId =
  | "categorical-exclusion"
  | "frequency-limit"
  | "benefit-exhausted";

export type DuplicateBranchId =
  | "true-duplicate-error"
  | "resubmission-after-correction"
  | "split-billing";

export type ExperimentalBranchId =
  | "fda-approved"
  | "off-label"
  | "no-ncd";

export type WrongPayerBranchId =
  | "primary"
  | "secondary"
  | "medicare-secondary";

export interface StrategyBranch {
  id: string;
  label: string;
  leadArgument: string;
  sectionOrder?: SectionId[];
  requiredFacts?: FactKey[];
}

export interface DenialStrategy {
  id: StrategyId;
  leadArgument: string;
  sectionOrder: SectionId[];
  requiredFacts: FactKey[];
  branchQuestion?: string;
  branches?: StrategyBranch[];
  clinicalWarning?: string;
}

const BASE_SECTIONS: SectionId[] = [
  "relief-requested",
  "claim-summary",
  "denial-basis",
  "administrative-argument",
  "escalation",
  "signature",
];

const AUTH_BRANCH_A: StrategyBranch = {
  id: "A",
  label: "Authorization was obtained — number is on file",
  leadArgument:
    "The authorization number on file was obtained for this service and provider and applies to the billed claim. This is a payer processing error. Request reprocessing with the authorization number cited from the ledger — not reconsideration.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "authorization-status",
    "administrative-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: ["claim.authorizationNumber"],
};

const AUTH_BRANCH_B: StrategyBranch = {
  id: "B",
  label: "No authorization was obtained prior to service",
  leadArgument:
    "No prior authorization number is on file. We request retroactive authorization review. Separately, the plan must demonstrate that advance authorization was required for this specific service and that adequate notice of that requirement was provided before the date of service.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "authorization-status",
    "administrative-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [],
};

const AUTH_BRANCH_C: StrategyBranch = {
  id: "C",
  label: "Authorization requirement is disputed",
  leadArgument:
    "The plan has not identified the specific provision requiring prior authorization for this service. We dispute that authorization was required under the member's plan documents and request reversal of the denial on that basis.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "authorization-status",
    "administrative-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [],
};

export const AUTHORIZATION_STRATEGY: DenialStrategy = {
  id: "authorization",
  leadArgument: AUTH_BRANCH_B.leadArgument,
  sectionOrder: AUTH_BRANCH_B.sectionOrder!,
  requiredFacts: [],
  branchQuestion: "What is the authorization status for this claim?",
  branches: [AUTH_BRANCH_A, AUTH_BRANCH_B, AUTH_BRANCH_C],
};

const BUNDLING_BRANCHES: StrategyBranch[] = [
  {
    id: "modifier-25",
    label:
      "Modifier 25 — significant, separately identifiable E/M with same-day procedure",
    leadArgument: `The E/M service (CPT 99213) was a significant, separately identifiable evaluation and management service distinct from the procedure performed on the same date (CPT 93000). Under CMS NCCI Policy Manual, Chapter 1, modifier 25 exempts significant and separately identifiable E/M services from National Correct Coding Initiative bundling edits when the E/M visit exceeds the work ordinarily associated with the procedure.`,
  },
  {
    id: "modifier-59",
    label: "Modifier 59 / X{EPSU} applied — distinct procedural service",
    leadArgument: `Modifier 59 (or the applicable X{EPSU} modifier) was appended to indicate that the service was a distinct procedural service not ordinarily reported together with the primary procedure. The operative or clinical record documents that the service was performed at a different session, different site, different incision, or on a different organ or structure. The NCCI PTP edit for this code pair carries a modifier indicator of 1, permitting unbundling with an appropriate modifier.`,
  },
  {
    id: "no-ncci-edit",
    label: "No NCCI PTP edit exists for this code pair",
    leadArgument: `There is no NCCI Procedure-to-Procedure edit for the code pair billed. The bundling of these services is not supported by the NCCI edit table and does not reflect a valid coding or coverage rule. The payer must identify the specific policy basis for bundling services that the NCCI does not bundle.`,
  },
  {
    id: "modifier-indicator-0",
    label:
      "NCCI edit exists but modifier indicator is 0 — challenging medical policy",
    leadArgument: `The NCCI PTP edit for this code pair carries a modifier indicator of 0, meaning that no modifier can override the edit under NCCI policy. However, the clinical record documents that the services were performed under circumstances not contemplated by the edit. We request that the plan's medical director review the operative record and apply clinical judgment rather than automated edit adjudication, consistent with the plan's obligation to conduct a meaningful review of the claim.`,
  },
];

export const BUNDLING_STRATEGY: DenialStrategy = {
  id: "bundling",
  leadArgument: `The payer has bundled this service into the payment for another procedure. The services billed are distinct, separately identifiable, and not components of the primary procedure. The applicable NCCI edit and modifier policy support separate reimbursement.`,
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "bundling-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.cptCodes",
    "claim.deniedAmount",
    "patient.name",
    "patient.memberId",
    "patient.planType",
  ],
  branchQuestion: "What is the basis for separate billing?",
  branches: BUNDLING_BRANCHES,
};

const TIMELY_FILING_BRANCHES: StrategyBranch[] = [
  {
    id: "proof-of-timely-submission",
    label:
      "Claim was submitted on time — have proof (clearinghouse report, ERA)",
    leadArgument: `The claim was submitted within the contractual filing period. Proof of timely submission is enclosed, including the clearinghouse transmission report or electronic remittance advice confirming the submission date. The plan's denial is inconsistent with the submission record and must be reversed.`,
  },
  {
    id: "coordination-of-benefits",
    label: "Delay caused by coordination of benefits with another payer",
    leadArgument: `Any delay in submission beyond the primary filing period was caused by coordination of benefits with the primary payer. The filing period for secondary claims runs from the date of the primary payer's explanation of benefits, not from the date of service. The claim was submitted within the applicable secondary filing period.`,
  },
  {
    id: "good-cause",
    label:
      "Good cause exists for the delay (patient eligibility issue, disaster, etc.)",
    leadArgument: `Good cause exists for any delay in submission beyond the filing period. The delay was caused by circumstances beyond the provider's control, including [[REQUIRED: claim.goodCauseDescription — describe the reason for the delay]]. Most plan documents and state prompt-pay statutes recognize good cause exceptions to timely filing requirements. Denial without consideration of good cause does not constitute a valid determination.`,
  },
  {
    id: "plan-error",
    label: "Plan returned or rejected the claim in error, causing the delay",
    leadArgument: `The claim was originally submitted within the filing period but was returned or rejected by the plan due to a plan-side processing error. The resubmission following correction of the plan's error should not be counted against the filing period. The delay is attributable to the plan, not the provider.`,
  },
];

export const TIMELY_FILING_STRATEGY: DenialStrategy = {
  id: "timely-filing",
  leadArgument: `The payer has denied this claim on the basis that the timely filing limit has expired. The claim was submitted within the required filing period, or good cause exists for any delay. The denial is not supported by the submission record.`,
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "timely-filing-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.cptCodes",
    "claim.deniedAmount",
    "patient.name",
    "patient.memberId",
    "patient.planType",
  ],
  branchQuestion: "What is the basis for the timely filing appeal?",
  branches: TIMELY_FILING_BRANCHES,
};

export const MEDICAL_NECESSITY_STRATEGY: DenialStrategy = {
  id: "medical-necessity",
  leadArgument: `The payer has determined that the service is not medically necessary. This determination is not supported by the clinical record, the applicable coverage criteria, or the published guidelines of the relevant specialty society. The clinical facts documented below satisfy every criterion the plan's own coverage policy requires for this service.`,
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "clinical-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.cptCodes",
    "claim.deniedAmount",
    "patient.name",
    "patient.memberId",
    "patient.planType",
    "clinical.primaryDiagnosis",
  ],
  clinicalWarning: `Medical necessity appeal: clinical.primaryDiagnosis is required. Populate in Step 3 before generating. Other clinical fields strengthen the argument significantly — conservativeCareTried and functionalImpact are highest value.`,
};

const CLAIM_DEFECT_BRANCHES: StrategyBranch[] = [
  {
    id: "missing-info",
    label: "Missing information cited — information is on file or enclosed",
    leadArgument:
      "The payer denied this claim for missing information. The cited deficiency does not reflect the actual submission record. All required data elements are present on the original claim or are enclosed with this appeal. The denial is a technical processing error, not a clinical or coverage determination. Correct the record and reprocess.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.number", "patient.name", "patient.memberId"],
  },
  {
    id: "invalid-info",
    label: "Invalid information cited — values are correct on the claim",
    leadArgument:
      "The payer identified invalid claim data. The billed codes, modifiers, dates, and identifiers are valid and consistent with the clinical record and payer files. The defect asserted by the payer does not exist or has been corrected. Request reprocessing with the corrected claim data reflected in the enclosed documentation.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.number", "claim.cptCodes", "claim.dateOfService"],
  },
  {
    id: "duplicate-submission-flag",
    label: "Claim flagged as duplicate submission in error",
    leadArgument:
      "The payer treated this resubmission as a defective duplicate filing. This claim is a corrected or original submission distinct from any prior transaction. The technical submission flag does not negate coverage or medical necessity. Reprocess as a valid claim, not as a duplicate denial.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.number"],
  },
];

export const CLAIM_DEFECT_STRATEGY: DenialStrategy = {
  id: "claim-defect",
  leadArgument:
    "This claim was denied for a technical deficiency, not for clinical reasons. The cited defect has been corrected or was not present on the original submission. The payer must reprocess the claim and cannot use an administrative coding error to avoid its coverage obligation.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "administrative-argument",
    "procedural-obligations",
    "authority-sections",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.cptCodes",
    "patient.name",
    "patient.memberId",
  ],
  branchQuestion: "What type of claim defect was cited?",
  branches: CLAIM_DEFECT_BRANCHES,
};

const NON_COVERED_BRANCHES: StrategyBranch[] = [
  {
    id: "categorical-exclusion",
    label: "Categorical exclusion — service is covered under the plan",
    leadArgument:
      "The payer applied a categorical exclusion that does not apply to this service. The procedure is a covered benefit under the patient's plan documents and, where applicable, under ACA essential health benefit requirements. Demand the specific plan provision supporting exclusion and reverse the denial.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "authority-sections",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.cptCodes", "patient.planType"],
  },
  {
    id: "frequency-limit",
    label: "Frequency or unit limit — limit not exceeded or medically necessary",
    leadArgument:
      "The payer denied based on a frequency or unit limit. The member has not exceeded the applicable benefit limit for this service period, or additional units are medically necessary based on the enclosed clinical documentation. Apply medical policy on its merits rather than a blanket frequency cap.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "authority-sections",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.cptCodes", "clinical.primaryDiagnosis"],
  },
  {
    id: "benefit-exhausted",
    label: "Benefit exhausted — benefits remain or exception applies",
    leadArgument:
      "The payer asserts that plan benefits for this service category are exhausted. Plan records and the member's benefit summary demonstrate remaining eligibility, or an exception applies for medically necessary care. Provide the benefit verification and demand payment for the denied amount.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "authority-sections",
      "escalation",
      "signature",
    ],
    requiredFacts: ["patient.memberId", "patient.planType"],
  },
];

export const NON_COVERED_STRATEGY: DenialStrategy = {
  id: "non-covered",
  leadArgument:
    "The service is covered under the plan's essential health benefits or the provider's participation agreement. The exclusion cited by the payer is inapplicable, unsupported by plan language, or contradicted by the member's active benefit election.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "administrative-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.cptCodes",
    "claim.deniedAmount",
    "patient.name",
    "patient.memberId",
    "patient.planType",
  ],
  branchQuestion: "What type of non-covered denial was asserted?",
  branches: NON_COVERED_BRANCHES,
};

const DUPLICATE_BRANCHES: StrategyBranch[] = [
  {
    id: "true-duplicate-error",
    label: "Not a duplicate — DOS, service, or provider differs",
    leadArgument:
      "This is not a duplicate claim. The date of service, procedure code, rendering provider, or claim number differs from the allegedly matching paid or denied claim. Identify the duplicate claim number the payer relied upon and demonstrate that the services are distinct. Demand reprocessing and payment.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.number", "claim.dateOfService", "claim.cptCodes"],
  },
  {
    id: "resubmission-after-correction",
    label: "Corrected resubmission after payer rejection",
    leadArgument:
      "This submission is a corrected claim following payer rejection or request for correction, not a duplicate of a paid service. The original was never paid in full. Reprocess the corrected claim and apply payment to the denied balance.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.number"],
  },
  {
    id: "split-billing",
    label: "Split billing — distinct line items or modifiers",
    leadArgument:
      "The payer improperly treated separately billable line items as duplicates. Modifier usage, distinct procedure codes, or separate dates of service support independent payment. Unbundle and pay each eligible line.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "bundling-argument",
      "administrative-argument",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.cptCodes", "claim.modifiers"],
  },
];

export const DUPLICATE_STRATEGY: DenialStrategy = {
  id: "duplicate",
  leadArgument:
    "This is not a duplicate claim. Either the date of service, service, rendering provider, or billed amount differs from the previously adjudicated claim, or the original claim was never paid. Request identification of the alleged duplicate claim number and demand reprocessing.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "administrative-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "claim.dateOfService",
    "claim.cptCodes",
    "patient.name",
  ],
  branchQuestion: "Why is this not a duplicate?",
  branches: DUPLICATE_BRANCHES,
};

const EXPERIMENTAL_BRANCHES: StrategyBranch[] = [
  {
    id: "fda-approved",
    label: "FDA-approved or cleared for this indication",
    leadArgument:
      "The service is not experimental. It is FDA-approved or FDA-cleared for the billed indication, widely adopted in clinical practice, and supported by peer-reviewed literature. The payer's technology assessment or medical policy is outdated or misapplied. Demand coverage consistent with FDA labeling and CMS national coverage determinations where applicable.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "authority-sections",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.cptCodes", "clinical.primaryDiagnosis"],
  },
  {
    id: "off-label",
    label: "Off-label use supported by clinical evidence",
    leadArgument:
      "Even if the payer characterizes use as off-label, the treatment is supported by compendia listings, specialty society guidelines, and peer-reviewed evidence for this diagnosis. Off-label use does not equate to experimental or investigational status. Request independent medical review under plan and state external review requirements.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "authority-sections",
      "escalation",
      "signature",
    ],
    requiredFacts: ["clinical.primaryDiagnosis", "clinical.procedureNarrative"],
  },
  {
    id: "no-ncd",
    label: "No applicable NCD/LCD — local coverage supports payment",
    leadArgument:
      "No CMS national coverage determination prohibits payment for this service in this clinical context. Applicable local coverage determinations and plan medical policy, when correctly applied, support coverage. The payer must cite a specific, binding coverage rule rather than a generic experimental denial.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "authority-sections",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["claim.cptCodes"],
  },
];

export const EXPERIMENTAL_STRATEGY: DenialStrategy = {
  id: "experimental",
  leadArgument:
    "The service is not experimental or investigational. It is supported by peer-reviewed literature, FDA approval or clearance where applicable, and established clinical guidelines for this patient population.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "clinical-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.cptCodes",
    "clinical.primaryDiagnosis",
    "patient.name",
  ],
  branchQuestion: "What evidence rebuts the experimental denial?",
  branches: EXPERIMENTAL_BRANCHES,
  clinicalWarning:
    "Experimental/investigational appeal: clinical.primaryDiagnosis and clinical.procedureNarrative strongly recommended before generation.",
};

const WRONG_PAYER_BRANCHES: StrategyBranch[] = [
  {
    id: "primary",
    label: "This payer is the primary payer",
    leadArgument:
      "This payer is the primary payer of record for this service. Coordination of benefits does not shift liability to another carrier. The claim was correctly directed here. Reprocess and pay the provider portion.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["patient.memberId", "patient.planType"],
  },
  {
    id: "secondary",
    label: "Secondary payer — primary EOB attached",
    leadArgument:
      "This payer is the secondary payer under coordination of benefits rules. Primary payer adjudication is complete and the explanation of benefits is enclosed. Calculate secondary liability from the primary allowed amount and pay the remaining covered balance.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "authority-sections",
      "escalation",
      "signature",
    ],
    requiredFacts: ["patient.memberId", "claim.paidAmount"],
  },
  {
    id: "medicare-secondary",
    label: "Medicare secondary payer rules apply",
    leadArgument:
      "Medicare secondary payer rules govern payment order for this claim. The enclosed eligibility and primary payer records establish that this plan remains liable either as primary or as secondary under MSP provisions. Reprocess under the correct COB hierarchy.",
    sectionOrder: [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "authority-sections",
      "procedural-obligations",
      "escalation",
      "signature",
    ],
    requiredFacts: ["patient.memberId", "patient.dateOfBirth"],
  },
];

export const WRONG_PAYER_STRATEGY: DenialStrategy = {
  id: "wrong-payer",
  leadArgument:
    "This payer is the correct primary or secondary payer under coordination of benefits rules. Provide the primary payer EOB or eligibility verification and demand reprocessing under the correct COB order.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "administrative-argument",
    "authority-sections",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [
    "claim.number",
    "patient.name",
    "patient.memberId",
    "patient.planType",
  ],
  branchQuestion: "What is the correct payer order?",
  branches: WRONG_PAYER_BRANCHES,
};

function stub(
  id: StrategyId,
  leadArgument: string,
  sectionOrder: SectionId[] = BASE_SECTIONS,
  requiredFacts: FactKey[] = []
): DenialStrategy {
  return { id, leadArgument, sectionOrder, requiredFacts };
}

const STRATEGIES: Record<StrategyId, DenialStrategy> = {
  authorization: AUTHORIZATION_STRATEGY,
  "claim-defect": CLAIM_DEFECT_STRATEGY,
  duplicate: DUPLICATE_STRATEGY,
  "timely-filing": TIMELY_FILING_STRATEGY,
  contractual: stub(
    "contractual",
    "Argue contract rate or fee schedule applicability.",
    [...BASE_SECTIONS.slice(0, 3), "clinical-argument", ...BASE_SECTIONS.slice(3)]
  ),
  "medical-necessity": MEDICAL_NECESSITY_STRATEGY,
  experimental: EXPERIMENTAL_STRATEGY,
  "not-proven": stub(
    "not-proven",
    "Establish the service is proven effective for this patient.",
    [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "escalation",
      "signature",
    ]
  ),
  "non-covered": NON_COVERED_STRATEGY,
  bundling: BUNDLING_STRATEGY,
  "dx-not-covered": stub(
    "dx-not-covered",
    "Establish the diagnosis is covered for the billed service.",
    [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "escalation",
      "signature",
    ]
  ),
  "not-covered-benefit": stub(
    "not-covered-benefit",
    "Establish the service is covered under the patient's current benefit plan.",
    BASE_SECTIONS
  ),
  "wrong-payer": WRONG_PAYER_STRATEGY,
  unknown: stub(
    "unknown",
    "Request reconsideration based on claim identifiers and payer-stated denial codes.",
    BASE_SECTIONS
  ),
};

export function getStrategy(id: StrategyId): DenialStrategy {
  return STRATEGIES[id] ?? STRATEGIES.unknown;
}

export const AUTH_BRANCH_B_CLINICAL_SUFFIX =
  " We further request retroactive authorization review on the grounds that the service was medically necessary and supported by the clinical record.";

/** Branch B lead — procedural only, or with clinical necessity when facts exist. */
export function buildAuthBranchBLeadArgument(includeClinical: boolean): string {
  const branch = AUTHORIZATION_STRATEGY.branches!.find((b) => b.id === "B");
  const procedural = branch?.leadArgument ?? "";
  return includeClinical ? procedural + AUTH_BRANCH_B_CLINICAL_SUFFIX : procedural;
}

export function getAuthBranch(id: AuthBranchId): StrategyBranch {
  const effectiveId = id === "D" ? "B" : id;
  const branch = AUTHORIZATION_STRATEGY.branches!.find((b) => b.id === effectiveId);
  if (!branch) throw new Error(`Unknown auth branch: ${id}`);
  return branch;
}

export function getBundlingBranch(id: BundlingBranchId): StrategyBranch {
  const branch = BUNDLING_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown bundling branch: ${id}`);
  return branch;
}

export function getTimelyFilingBranch(id: TimelyFilingBranchId): StrategyBranch {
  const branch = TIMELY_FILING_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown timely filing branch: ${id}`);
  return branch;
}

export function getClaimDefectBranch(id: ClaimDefectBranchId): StrategyBranch {
  const branch = CLAIM_DEFECT_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown claim defect branch: ${id}`);
  return branch;
}

export function getNonCoveredBranch(id: NonCoveredBranchId): StrategyBranch {
  const branch = NON_COVERED_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown non-covered branch: ${id}`);
  return branch;
}

export function getDuplicateBranch(id: DuplicateBranchId): StrategyBranch {
  const branch = DUPLICATE_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown duplicate branch: ${id}`);
  return branch;
}

export function getExperimentalBranch(id: ExperimentalBranchId): StrategyBranch {
  const branch = EXPERIMENTAL_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown experimental branch: ${id}`);
  return branch;
}

export function getWrongPayerBranch(id: WrongPayerBranchId): StrategyBranch {
  const branch = WRONG_PAYER_STRATEGY.branches!.find((b) => b.id === id);
  if (!branch) throw new Error(`Unknown wrong payer branch: ${id}`);
  return branch;
}

/** Primary strategy priority when multiple CARCs present. */
export const STRATEGY_PRIORITY: StrategyId[] = [
  "authorization",
  "bundling",
  "medical-necessity",
  "claim-defect",
  "duplicate",
  "timely-filing",
  "wrong-payer",
  "contractual",
  "experimental",
  "not-proven",
  "non-covered",
  "not-covered-benefit",
  "dx-not-covered",
  "unknown",
];

export function pickPrimaryStrategy(ids: StrategyId[]): StrategyId {
  const unique = [...new Set(ids)];
  for (const p of STRATEGY_PRIORITY) {
    if (unique.includes(p)) return p;
  }
  return "unknown";
}
