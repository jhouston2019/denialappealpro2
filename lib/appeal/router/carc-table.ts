import { sanitizeCarcDescription } from "../format/sanitizeCodes";
import type { StrategyId } from "./strategies";
import {
  defaultPrimaryArgument,
  inferAdministrative,
  inferCorrectedClaimFirst,
  inferStrategyId,
} from "./carc-strategy-infer";
import officialDescriptions from "./carc-official-descriptions.json";

export { sanitizeCarcDescription } from "../format/sanitizeCodes";

/** Clean payer-facing descriptors (no X12/835 remark suffixes). */
const DESCRIPTOR_OVERRIDES: Partial<Record<string, string>> = {
  "50":
    "These are non-covered services because this is not deemed a medical necessity by the payer.",
};

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

/** Tailored primary arguments for high-volume denial codes. */
const PRIMARY_ARGUMENT_OVERRIDES: Partial<Record<string, string>> = {
  "15":
    "The denial reflects an authorization or precertification issue, not a coverage or medical necessity determination.",
  "16":
    "The denial cites missing or incorrect claim information; request reconsideration after correcting the identified defect.",
  "18":
    "The claim is not a duplicate; distinguish this service from any prior adjudicated claim.",
  "22":
    "This payer is primary for this service; coordination of benefits does not apply.",
  "29":
    "The claim was filed within the applicable timely filing limit or good cause applies.",
  "45":
    "The billed charge is consistent with contract terms or should be paid at the contracted rate.",
  "50":
    "The service meets medical necessity criteria supported by the clinical record.",
  "55":
    "The service is established and not experimental or investigational for this indication.",
  "96": "The charge is a covered benefit under the patient's plan.",
  "97":
    "This service is separately payable and was not included in payment for another procedure.",
  "119":
    "The member has not exhausted applicable benefit limits for this service.",
  "125":
    "Correct the identified billing or submission error and request reprocessing.",
  "167": "The diagnosis is covered under the plan for the billed service.",
  "170":
    "The rendering provider type is eligible to perform and bill this service under plan rules.",
  "181": "The CPT/HCPCS code was valid and active on the date of service.",
  "182": "The modifier was valid and appropriate on the date of service.",
  "185":
    "The rendering provider is credentialed and eligible to perform this service.",
  "197":
    "Required authorization or notification was obtained or exception applies.",
  "204": "The service is a covered benefit under the patient's current plan.",
  "227":
    "All requested information has been provided or was not required for adjudication.",
  "233":
    "This claim is appropriately filed with this payer, not a workers comp or auto carrier.",
};

function buildEntries(): CarcEntry[] {
  const entries: CarcEntry[] = [];
  for (const [code, rawDescriptor] of Object.entries(officialDescriptions)) {
    const strategyId = inferStrategyId(code, rawDescriptor);
    const descriptor =
      DESCRIPTOR_OVERRIDES[code] ??
      sanitizeCarcDescription(String(rawDescriptor));
    entries.push({
      code,
      descriptor,
      strategyId,
      primaryArgument:
        PRIMARY_ARGUMENT_OVERRIDES[code] ??
        defaultPrimaryArgument(strategyId, descriptor),
      isAdministrative: inferAdministrative(strategyId, descriptor),
      correctedClaimFirst: inferCorrectedClaimFirst(strategyId, descriptor),
    });
  }
  entries.sort((a, b) => {
    const na = parseInt(a.code, 10);
    const nb = parseInt(b.code, 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.code.localeCompare(b.code);
  });
  return entries;
}

const ENTRIES = buildEntries();

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
    descriptor.includes("Precertification/authorization") ||
    descriptor.includes("authorization number is missing, invalid");
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
