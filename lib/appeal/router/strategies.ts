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
  | "modifier-59"
  | "no-ncci-edit"
  | "modifier-indicator-0";

export type TimelyFilingBranchId =
  | "proof-of-timely-submission"
  | "coordination-of-benefits"
  | "good-cause"
  | "plan-error";

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
    "This is a payer processing error. The authorization number is on file and applies to the billed service and provider. Request reprocessing, not reconsideration.",
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
  label: "Authorization was obtained for a different CPT code",
  leadArgument:
    "Authorization was obtained prior to service. Intraoperative or clinical findings necessitated the billed procedure in lieu of or in addition to the authorized procedure. The original authorization establishes the plan's acknowledgment of medical necessity for the surgical episode.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "authorization-status",
    "administrative-argument",
    "clinical-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: ["claim.authorizationNumber", "clinical.procedureNarrative"],
};

const AUTH_BRANCH_C: StrategyBranch = {
  id: "C",
  label: "Authorization applies to a different rendering provider or TIN",
  leadArgument:
    "Administrative mismatch between rendering provider and authorized provider. The service was clinically authorized; the denial reflects a billing correction, not a coverage determination.",
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

const AUTH_BRANCH_D: StrategyBranch = {
  id: "D",
  label: "No authorization was obtained prior to service",
  leadArgument:
    "No prior authorization was obtained. The appeal argues on three grounds: (1) retroactive authorization under the plan's own retro-auth policy, (2) notice/waiver — the plan's obligation to notify of auth requirements in advance, (3) disproportionate remedy — denial of payment is disproportionate to the administrative defect where medical necessity is not in dispute.",
  sectionOrder: [
    "relief-requested",
    "claim-summary",
    "denial-basis",
    "authorization-status",
    "administrative-argument",
    "clinical-argument",
    "procedural-obligations",
    "escalation",
    "signature",
  ],
  requiredFacts: [],
};

export const AUTHORIZATION_STRATEGY: DenialStrategy = {
  id: "authorization",
  leadArgument: AUTH_BRANCH_D.leadArgument,
  sectionOrder: AUTH_BRANCH_D.sectionOrder!,
  requiredFacts: [],
  branchQuestion: "What is the authorization status for this claim?",
  branches: [AUTH_BRANCH_A, AUTH_BRANCH_B, AUTH_BRANCH_C, AUTH_BRANCH_D],
};

const BUNDLING_BRANCHES: StrategyBranch[] = [
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
  "claim-defect": stub(
    "claim-defect",
    "Correct the identified claim submission or billing defect and request reprocessing.",
    [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "administrative-argument",
      "procedural-obligations",
      "escalation",
      "signature",
    ]
  ),
  duplicate: stub(
    "duplicate",
    "Demonstrate this claim is not a duplicate of a previously paid or denied service.",
    BASE_SECTIONS
  ),
  "timely-filing": TIMELY_FILING_STRATEGY,
  contractual: stub(
    "contractual",
    "Argue contract rate or fee schedule applicability.",
    [...BASE_SECTIONS.slice(0, 3), "clinical-argument", ...BASE_SECTIONS.slice(3)]
  ),
  "medical-necessity": MEDICAL_NECESSITY_STRATEGY,
  experimental: stub(
    "experimental",
    "Establish the service is not experimental or investigational.",
    [
      "relief-requested",
      "claim-summary",
      "denial-basis",
      "clinical-argument",
      "escalation",
      "signature",
    ]
  ),
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
  "non-covered": stub(
    "non-covered",
    "Establish the charge is a covered benefit under the plan.",
    BASE_SECTIONS
  ),
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
  "wrong-payer": stub(
    "wrong-payer",
    "Establish this payer is responsible, not workers comp or auto liability.",
    BASE_SECTIONS
  ),
  unknown: stub(
    "unknown",
    "Request reconsideration based on claim identifiers and payer-stated denial codes.",
    BASE_SECTIONS
  ),
};

export function getStrategy(id: StrategyId): DenialStrategy {
  return STRATEGIES[id] ?? STRATEGIES.unknown;
}

export function getAuthBranch(id: AuthBranchId): StrategyBranch {
  const branch = AUTHORIZATION_STRATEGY.branches!.find((b) => b.id === id);
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
