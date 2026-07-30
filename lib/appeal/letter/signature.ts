import { getValue } from "../ledger/builder";
import { FACT_LABELS } from "../ledger/keys";
import type { FactKey, FactLedger } from "../ledger/types";
import { formatNpi } from "../format/render";

const MONTH =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const US_SLASH = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

/** True when a string looks like a calendar date (the live signer-slot bug). */
export function isDateShapedString(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return MONTH.test(s) || ISO.test(s) || US_SLASH.test(s);
}

function line(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function req(key: FactKey): string {
  return `[[REQUIRED: ${key} — ${FACT_LABELS[key]}]]`;
}

/**
 * System-rendered signature block bound to provider.* and signer.* ledger facts.
 * Date belongs only in the letter header — never repeated here.
 */
export function assembleSignatureBlock(ledger: FactLedger): string {
  const lines = ["Sincerely,"];

  const signerName = line(getValue(ledger, "signer.name"));
  const signerTitle = line(getValue(ledger, "signer.title"));
  const signerCredentials = line(getValue(ledger, "signer.credentials"));
  const signerPhone = line(getValue(ledger, "signer.phone"));

  const providerName = line(getValue(ledger, "provider.name"));
  const address = line(getValue(ledger, "provider.addressBlock"));
  const npiRaw = line(getValue(ledger, "provider.npi"));
  const npi = npiRaw ? formatNpi(npiRaw) : null;
  const phone = line(getValue(ledger, "provider.phone"));
  const fax = line(getValue(ledger, "provider.fax"));

  lines.push(
    signerName || req("signer.name")
  );
  lines.push(
    signerTitle || req("signer.title")
  );
  if (signerCredentials) lines.push(signerCredentials);

  lines.push(
    providerName || req("provider.name")
  );
  lines.push(
    address || req("provider.addressBlock")
  );
  lines.push(
    npi ? `NPI: ${npi}` : req("provider.npi")
  );

  const phoneFax = [
    phone ? `Phone: ${phone}` : req("provider.phone"),
    fax ? `Fax: ${fax}` : null,
  ]
    .filter(Boolean)
    .join("   ");
  lines.push(phoneFax);
  if (signerPhone && signerPhone !== phone) {
    lines.push(`Direct: ${signerPhone}`);
  }

  return lines.join("\n");
}

/** Strip trailing date-shaped lines the model may emit before the signature block. */
export function stripTrailingDateLines(text: string): string {
  let t = String(text || "").trimEnd();
  while (true) {
    const parts = t.split("\n");
    const last = parts[parts.length - 1]?.trim();
    if (last && isDateShapedString(last)) {
      t = parts.slice(0, -1).join("\n").trimEnd();
      continue;
    }
    break;
  }
  return t;
}

/** Strip a model-written Sincerely block (and anything after) before system rebind. */
export function stripTrailingSignature(letterBody: string): string {
  let text = stripTrailingDateLines(String(letterBody || ""));
  const idx = text.search(/\nSincerely,?[\s\S]*$/i);
  if (idx >= 0) return text.slice(0, idx).replace(/\s+$/, "");
  if (/^Sincerely,?/i.test(text.trim())) {
    return "";
  }
  return text.replace(/\s+$/, "");
}
