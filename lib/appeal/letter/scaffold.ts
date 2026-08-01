import { getValue } from "../ledger/builder";
import { FACT_LABELS } from "../ledger/keys";
import type { FactKey, FactLedger, FactValue } from "../ledger/types";
import {
  formatCodesList,
  formatCurrency,
  formatLetterDate,
  formatNpi,
} from "../format/render";
import { normalizeIcd10Array } from "../format/normalizeIcd10";

function str(v: FactValue | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v).trim();
}

function arr(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function req(key: FactKey): string {
  return `[[REQUIRED: ${key} — ${FACT_LABELS[key]}]]`;
}

function orReq(value: string, key: FactKey): string {
  return value || req(key);
}

/**
 * System-rendered letterhead, date, payer address, and RE block from the ledger.
 * Currency/dates/codes go through the formatting layer.
 */
export function renderLetterScaffold(ledger: FactLedger): string {
  const providerName = orReq(str(getValue(ledger, "provider.name")), "provider.name");
  const address = orReq(
    str(getValue(ledger, "provider.addressBlock")),
    "provider.addressBlock"
  );
  const phone = str(getValue(ledger, "provider.phone"));
  const fax = str(getValue(ledger, "provider.fax"));
  const npiRaw = str(getValue(ledger, "provider.npi"));
  const npi = npiRaw ? formatNpi(npiRaw) : "";
  const tin = str(getValue(ledger, "provider.tin"));
  const payerName = orReq(
    str(getValue(ledger, "claim.payerName")),
    "claim.payerName"
  );
  const payerAddr = orReq(
    str(getValue(ledger, "claim.payerAppealAddress")),
    "claim.payerAppealAddress"
  );

  const phoneFax = [
    `Phone: ${orReq(phone, "provider.phone")}`,
    fax ? `Fax: ${fax}` : null,
  ]
    .filter(Boolean)
    .join("   ");

  const npiTin = [
    `NPI: ${orReq(npi, "provider.npi")}`,
    tin ? `TIN: ${tin}` : null,
  ]
    .filter(Boolean)
    .join("   ");

  const today = formatLetterDate(new Date().toISOString().slice(0, 10));
  const claim = orReq(str(getValue(ledger, "claim.number")), "claim.number");
  const patient = orReq(str(getValue(ledger, "patient.name")), "patient.name");
  const member = orReq(
    str(getValue(ledger, "patient.memberId")),
    "patient.memberId"
  );
  const groupName = str(getValue(ledger, "patient.groupName"));
  const groupNumber = str(getValue(ledger, "patient.groupNumber"));
  const dosRaw = str(getValue(ledger, "claim.dateOfService"));
  const dos = dosRaw
    ? formatLetterDate(dosRaw)
    : req("claim.dateOfService");
  const cptArr = arr(getValue(ledger, "claim.cptCodes"));
  const cpt = cptArr.length ? cptArr.join(", ") : req("claim.cptCodes");
  const icdCodes = normalizeIcd10Array(arr(getValue(ledger, "claim.icd10Codes")));
  const icdFallback = normalizeIcd10Array(arr(getValue(ledger, "clinical.icd10Codes")));
  const icdAll = icdCodes.length ? icdCodes : icdFallback;
  const icdLine = icdAll.length
    ? `    ICD-10: ${icdAll.join(", ")}${str(getValue(ledger, "clinical.primaryDiagnosis")) ? ` — ${str(getValue(ledger, "clinical.primaryDiagnosis"))}` : ""}`
    : "";
  const billedRaw = str(getValue(ledger, "claim.billedAmount"));
  const billed = billedRaw
    ? formatCurrency(billedRaw)
    : req("claim.billedAmount");
  const deniedRaw = str(getValue(ledger, "claim.deniedAmount"));
  const denied = deniedRaw
    ? formatCurrency(deniedRaw)
    : req("claim.deniedAmount");
  const carc = formatCodesList(getValue(ledger, "claim.carcCodes"), "carc");
  const rarc = formatCodesList(getValue(ledger, "claim.rarcCodes"), "rarc");
  const denialCodes =
    [carc, rarc].filter(Boolean).join(" / ") || req("claim.carcCodes");
  const appealLevel = str(getValue(ledger, "appeal.level")) || "First-level";

  // Group number is not ALWAYS_REQUIRED; show a placeholder only when group
  // name is present but the number was never collected (letter-a demo case).
  const groupNumPart = groupNumber
    ? ` (#${groupNumber})`
    : groupName
      ? ` (${req("patient.groupNumber")})`
      : "";
  const groupLine =
    groupName || groupNumber
      ? `    Group: ${groupName || "—"}${groupNumPart}`
      : "";

  const lines = [
    providerName,
    address,
    phoneFax,
    npiTin,
    "",
    today,
    "",
    payerName,
    payerAddr,
    "",
    `Re: Formal Appeal — Claim ${claim}`,
    `    Patient: ${patient} | Member ID: ${member}`,
    groupLine,
    `    DOS: ${dos}`,
    `    CPT: ${cpt} | Billed: ${billed}`,
    icdLine,
    `    Denied: ${denied}`,
    `    Denial Codes: ${denialCodes}`,
    `    Appeal Level: ${appealLevel}`,
    "",
  ];

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Strip model letterhead / Re: / Sincerely so scaffold + signature can own those regions. */
export function extractAppealBody(modelText: string): string {
  let t = String(modelText || "").trim();
  t = t.replace(/^[\s\S]*?(?=To the Appeals Review Department[:]?)/i, "");
  if (!t) {
    t = String(modelText || "")
      .replace(/^[\s\S]*?\nRe:[^\n]*\n(?:[^\n]*\n)*?\n/i, "")
      .trim();
  }
  t = t.replace(/\nSincerely,?[\s\S]*$/i, "").trim();
  return t;
}
