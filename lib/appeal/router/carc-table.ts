import type { StrategyId } from "./strategies";

export interface CarcEntry {
  code: string;
  descriptor: string;
  strategyId: StrategyId;
  primaryArgument: string;
  isAdministrative: boolean;
  correctedClaimFirst: boolean;
}

/** Normalize raw payer CARC token to lookup key (digits or B15). */
export function normalizeCarcCode(raw: string): string {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (/^B\d+/.test(s)) return s.match(/^B\d+/)![0];
  const stripped = s.replace(/^(CO|PR|OA|CARC)[-\s]*/i, "");
  const digits = stripped.replace(/\D/g, "");
  if (!digits) return stripped;
  return String(parseInt(digits, 10));
}

const ENTRIES: CarcEntry[] = [
  {
    code: "1",
    descriptor: "Deductible amount",
    strategyId: "contractual",
    primaryArgument:
      "The patient responsibility reflects deductible application; the provider portion should be paid per contract.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "2",
    descriptor: "Coinsurance amount",
    strategyId: "contractual",
    primaryArgument:
      "Coinsurance was applied incorrectly or the provider payment portion was denied in error.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "4",
    descriptor: "The service/equipment/drug is not covered by the plan.",
    strategyId: "non-covered",
    primaryArgument:
      "The service is a covered benefit under the patient's plan and should be reimbursed.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "5",
    descriptor: "The procedure code/type of bill is inconsistent with the place of service",
    strategyId: "claim-defect",
    primaryArgument:
      "Correct the place-of-service or procedure coding inconsistency and request reprocessing.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "11",
    descriptor: "The diagnosis is inconsistent with the procedure",
    strategyId: "claim-defect",
    primaryArgument:
      "The diagnosis supports the billed procedure; request reconsideration with corrected coding alignment.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "15",
    descriptor:
      "Payment adjusted because the submitted authorization number is missing, invalid, or does not apply to the billed services or provider",
    strategyId: "authorization",
    primaryArgument:
      "The denial reflects an authorization or precertification issue, not a coverage or medical necessity determination.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
  {
    code: "16",
    descriptor: "Claim/service lacks information or has submission/billing error(s)",
    strategyId: "claim-defect",
    primaryArgument:
      "The denial cites missing or incorrect claim information; request reconsideration after correcting the identified defect.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "18",
    descriptor: "Exact duplicate claim/service",
    strategyId: "duplicate",
    primaryArgument:
      "The claim is not a duplicate; distinguish this service from any prior adjudicated claim.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "22",
    descriptor: "This care may be covered by another payer per coordination of benefits",
    strategyId: "wrong-payer",
    primaryArgument:
      "This payer is primary for this service; coordination of benefits does not apply.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "27",
    descriptor: "Expenses incurred after coverage terminated",
    strategyId: "claim-defect",
    primaryArgument:
      "Coverage was active on the date of service; eligibility records confirm the member was covered.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
  {
    code: "29",
    descriptor: "The time limit for filing has expired",
    strategyId: "timely-filing",
    primaryArgument:
      "The claim was filed within the applicable timely filing limit or good cause applies.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
  {
    code: "45",
    descriptor: "Charge exceeds fee schedule/maximum allowable",
    strategyId: "contractual",
    primaryArgument:
      "The billed charge is consistent with contract terms or should be paid at the contracted rate.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "50",
    descriptor:
      "These are non-covered services because this is not deemed a medical necessity by the payer",
    strategyId: "medical-necessity",
    primaryArgument:
      "The service meets medical necessity criteria supported by the clinical record.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "55",
    descriptor: "Procedure/treatment is deemed experimental/investigational",
    strategyId: "experimental",
    primaryArgument:
      "The service is established and not experimental or investigational for this indication.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "56",
    descriptor: "Procedure/treatment has not been deemed proven to be effective by the payer",
    strategyId: "not-proven",
    primaryArgument:
      "The service is proven effective and appropriate for this patient.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "96",
    descriptor: "Non-covered charge(s)",
    strategyId: "non-covered",
    primaryArgument:
      "The charge is a covered benefit under the patient's plan.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "97",
    descriptor:
      "The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated",
    strategyId: "bundling",
    primaryArgument:
      "This service is separately payable and was not included in payment for another procedure.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
  {
    code: "119",
    descriptor: "Benefit maximum for this time period or occurrence has been reached",
    strategyId: "non-covered",
    primaryArgument:
      "The member has not exhausted applicable benefit limits for this service.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "125",
    descriptor: "Submission/billing error(s)",
    strategyId: "claim-defect",
    primaryArgument:
      "Correct the identified billing or submission error and request reprocessing.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "167",
    descriptor: "This (these) diagnosis(es) is (are) not covered",
    strategyId: "dx-not-covered",
    primaryArgument:
      "The diagnosis is covered under the plan for the billed service.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "170",
    descriptor: "Payment is denied when performed/billed by this provider type",
    strategyId: "non-covered",
    primaryArgument:
      "The rendering provider type is eligible to perform and bill this service under plan rules.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "171",
    descriptor: "Payment is denied when performed/billed in this place of service",
    strategyId: "claim-defect",
    primaryArgument:
      "The place of service is appropriate and covered for this procedure.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "181",
    descriptor: "Procedure code was invalid on the date of service",
    strategyId: "claim-defect",
    primaryArgument:
      "The CPT/HCPCS code was valid and active on the date of service.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "182",
    descriptor: "Procedure modifier was invalid on the date of service",
    strategyId: "claim-defect",
    primaryArgument:
      "The modifier was valid and appropriate on the date of service.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "185",
    descriptor: "The rendering provider is not eligible to perform the service billed",
    strategyId: "non-covered",
    primaryArgument:
      "The rendering provider is credentialed and eligible to perform this service.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "197",
    descriptor: "Precertification/authorization/notification absent",
    strategyId: "authorization",
    primaryArgument:
      "Required authorization or notification was obtained or exception applies.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
  {
    code: "204",
    descriptor:
      "This service/equipment/drug is not covered under the patient's current benefit plan",
    strategyId: "not-covered-benefit",
    primaryArgument:
      "The service is a covered benefit under the patient's current plan.",
    isAdministrative: false,
    correctedClaimFirst: false,
  },
  {
    code: "227",
    descriptor:
      "Information requested from the patient/insured/responsible party was not provided or was insufficient/incomplete",
    strategyId: "claim-defect",
    primaryArgument:
      "All requested information has been provided or was not required for adjudication.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "233",
    descriptor:
      "Services/charges related to the treatment of a work-related and/or auto accident",
    strategyId: "wrong-payer",
    primaryArgument:
      "This claim is appropriately filed with this payer, not a workers comp or auto carrier.",
    isAdministrative: true,
    correctedClaimFirst: true,
  },
  {
    code: "B15",
    descriptor:
      "This service/procedure requires that a qualifying service/procedure be received and covered",
    strategyId: "bundling",
    primaryArgument:
      "The qualifying primary service was received and covered; this service is separately payable.",
    isAdministrative: true,
    correctedClaimFirst: false,
  },
];

const TABLE = new Map<string, CarcEntry>();
for (const entry of ENTRIES) {
  TABLE.set(entry.code, entry);
}

/** Descriptor used when CO-4 pairs with RARC M144 (NCCI bundling). */
export const CARC4_M144_BUNDLING_DESCRIPTOR =
  "The service/equipment/drug is not covered by the plan (NCCI bundling edit — modifier 25 may apply).";

/** CO-15 and 15 resolve to the same entry. */
export function lookupCarc(raw: string): CarcEntry | null {
  const key = normalizeCarcCode(raw);
  if (!key) return null;
  return TABLE.get(key) ?? null;
}

export function allCarcEntries(): CarcEntry[] {
  return [...ENTRIES];
}

/** Phrases that mischaracterize specific CARC descriptors (validator). */
export function inconsistentCharacterizations(
  descriptor: string,
  body: string
): string[] {
  const lower = body.toLowerCase();
  const hits: string[] = [];
  const isAuth =
    descriptor.includes("authorization number is missing") ||
    descriptor.includes("Precertification/authorization");
  if (isAuth) {
    for (const phrase of [
      "lack of information",
      "missing information",
      "not a covered benefit",
      "not deemed a covered benefit",
      "medical necessity denial",
      "denied for medical necessity",
    ]) {
      if (lower.includes(phrase)) hits.push(phrase);
    }
  }
  return hits;
}
