export type Provenance = "document" | "user" | "library" | "derived";

export type PlanType =
  | "erisa-self-funded"
  | "fully-insured-group"
  | "medicare-advantage"
  | "medicaid-mco"
  | "marketplace-individual"
  | "medicare-traditional"
  | "unknown";

export type FactKey =
  // claim — from EOB/denial document
  | "claim.number"
  | "claim.payerName"
  | "claim.payerAppealAddress"
  | "claim.dateOfService"
  | "claim.dateProcessed"
  | "claim.billedAmount"
  | "claim.allowedAmount"
  | "claim.paidAmount"
  | "claim.deniedAmount"
  | "claim.carcCodes"
  | "claim.rarcCodes"
  | "claim.cptCodes"
  | "claim.modifiers"
  | "claim.timelyFilingDays"
  | "claim.authorizationNumber"
  | "claim.goodCauseDescription"
  | "claim.appealAddressBlock"
  // patient / member
  | "patient.name"
  | "patient.memberId"
  | "patient.groupName"
  | "patient.groupNumber"
  | "patient.dateOfBirth"
  | "patient.planType"
  // provider — user-supplied, pre-filled from public.users
  | "provider.name"
  | "provider.npi"
  | "provider.tin"
  | "provider.addressBlock"
  | "provider.phone"
  | "provider.fax"
  // signer — user-supplied
  | "signer.name"
  | "signer.title"
  | "signer.credentials"
  | "signer.phone"
  // clinical — USER-ONLY. Never extracted.
  | "clinical.primaryDiagnosis"
  | "clinical.icd10Codes"
  | "clinical.indication"
  | "clinical.priorTreatments"
  | "clinical.conservativeCareTried"
  | "clinical.functionalImpact"
  | "clinical.urgency"
  | "clinical.procedureNarrative"
  // appeal meta
  | "appeal.level"
  | "appeal.deadline"
  | "appeal.authBranch"
  | "appeal.bundlingBranch"
  | "appeal.timelyFilingBranch";

export type FactValue = string | number | string[] | null;

export interface Fact {
  key: FactKey;
  value: FactValue;
  provenance: Provenance;
  /**
   * Auditable origin.
   *  document → 'doc:<fileId>:p<page>:<fieldLabel>'
   *  user     → 'wizard:step<N>:<fieldId>'
   *  library  → 'authority:<authorityId>'
   *  derived  → 'derived:<expression>'
   */
  sourceRef: string;
  /** 0–1. Only meaningful for provenance 'document'. User facts are 1. */
  confidence: number;
}

export interface EnclosureItem {
  id: string;
  label: string;
  checked: boolean;
  custom?: boolean;
}

export interface FactLedger {
  facts: Partial<Record<FactKey, Fact>>;
  enclosures: EnclosureItem[];
  meta: {
    ledgerVersion: 1;
    createdAt: string;
    documentIds: string[];
  };
}
