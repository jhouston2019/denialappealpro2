import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import { formatCarc, formatRarc } from "../format/render";
import { lookupCarc, routeDenial } from "../router/index";
import type { AuthorityRecord } from "./records";

function arr(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDenialCodesForErisa(ledger: FactLedger): string {
  const carcCodes = arr(getValue(ledger, "claim.carcCodes"));
  const rarcCodes = arr(getValue(ledger, "claim.rarcCodes"));
  const carcParts = carcCodes.map((c) => {
    const entry = lookupCarc(c);
    return entry ? formatCarc(c, entry.descriptor) : formatCarc(c);
  });
  const rarcParts = rarcCodes.map((c) => formatRarc(c));
  const parts = [...carcParts, ...rarcParts].filter(Boolean);
  return parts.length ? parts.join(" and ") : "the cited reason codes";
}

function denialBasisPhrase(ledger: FactLedger): string {
  const strategyId = routeDenial(ledger).strategy.id;
  switch (strategyId) {
    case "authorization":
      return "the submitted authorization number was missing, invalid, or inapplicable";
    case "bundling":
      return "the bundling or NCCI edit basis supports the denial";
    case "timely-filing":
      return "the timely filing requirement supports the denial";
    case "medical-necessity":
      return "the medical necessity determination supports the denial";
    default:
      return "the denial criteria were satisfied";
  }
}

function planProvisionPhrase(ledger: FactLedger): string {
  const strategyId = routeDenial(ledger).strategy.id;
  switch (strategyId) {
    case "authorization":
      return "the plan provision that imposes the prior authorization requirement";
    case "bundling":
      return "the plan provision, NCCI edit, or coverage policy requiring bundling";
    case "timely-filing":
      return "the plan provision establishing the timely filing period";
    default:
      return "the specific plan provision relied upon";
  }
}

/** Substitute ledger facts into authority argument templates at generation time. */
export function renderAuthorityRecord(
  record: AuthorityRecord,
  ledger: FactLedger
): AuthorityRecord {
  const claim = String(getValue(ledger, "claim.number") ?? "").trim() || "this claim";
  const denialCodes = formatDenialCodesForErisa(ledger);
  const basisPhrase = denialBasisPhrase(ledger);
  const provisionPhrase = planProvisionPhrase(ledger);
  const cptArr = arr(getValue(ledger, "claim.cptCodes"));
  const cptList = cptArr.length ? cptArr.join(", ") : "the billed procedure code(s)";

  if (record.id === "erisa-503-full-fair-review") {
    return {
      ...record,
      argument: `ERISA § 1133 and 29 C.F.R. § 2560.503-1 require that every adverse benefit determination set forth the specific reason for the denial and the specific plan provision on which the denial is based. The denial of claim ${claim} cites only ${denialCodes} without identifying ${provisionPhrase} or the criteria applied in determining that ${basisPhrase}. A denial that fails to cite the specific plan provision relied upon is procedurally defective under § 2560.503-1(g)(1)(i)–(ii) and does not constitute a valid adverse benefit determination.`,
    };
  }

  if (record.id === "erisa-503-document-production") {
    return {
      ...record,
      argument: `Pursuant to 29 C.F.R. § 2560.503-1(h)(2)(iii), the plan must provide, upon request and free of charge, copies of all documents, records, and other information relevant to the claimant's claim for benefits. We hereby request production of: (1) ${provisionPhrase} for CPT ${cptList}; (2) the clinical or coding criteria applied; (3) all communications regarding this claim; and (4) the identity and qualifications of any clinical reviewer. Failure to produce these documents within the appeal review period will constitute an additional procedural violation under § 2560.503-1.`,
    };
  }

  return record;
}

export function renderAuthorityRecords(
  records: AuthorityRecord[],
  ledger: FactLedger
): AuthorityRecord[] {
  return records.map((record) => renderAuthorityRecord(record, ledger));
}
