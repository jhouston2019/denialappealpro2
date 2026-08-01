import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import { normalizeIcd10Array } from "../format/normalizeIcd10";
import { emptyLedger, mergeLedger, setFact } from "./builder";
import { DEFAULT_ENCLOSURES } from "./keys";
import type { EnclosureItem, FactKey, FactLedger } from "./types";

function strOrNull(v: string | undefined | null): string | null {
  const s = (v ?? "").trim();
  return s || null;
}

function arrOrNull(v: string[] | undefined): string[] | null {
  const a = (v || []).map((x) => String(x).trim()).filter(Boolean);
  return a.length ? a : null;
}

function icdArrOrNull(v: string[] | undefined): string[] | null {
  const a = normalizeIcd10Array(v);
  return a.length ? a : null;
}

/**
 * Overlay wizard/user-confirmed intake fields onto an existing document ledger.
 * Clinical fields are written with provenance 'user' only.
 */
export function applyIntakeToLedger(
  base: FactLedger | null | undefined,
  intake: DenialIntake,
  enclosures?: EnclosureItem[]
): FactLedger {
  let ledger = base
    ? { ...base, facts: { ...base.facts }, enclosures: [...(base.enclosures || [])] }
    : emptyLedger();

  const user = (
    key: FactKey,
    value: string | string[] | null,
    fieldId: string,
    step: 2 | 3 = 3
  ) => {
    if (value == null) return;
    if (typeof value === "string" && !value.trim()) return;
    if (Array.isArray(value) && !value.length) return;
    ledger = setFact(
      ledger,
      key,
      value,
      "user",
      `wizard:step${step}:${fieldId}`,
      1
    );
  };

  user("patient.name", strOrNull(intake.patientName), "patientName", 2);
  user("patient.memberId", strOrNull(intake.memberId), "memberId", 2);
  user("claim.payerName", strOrNull(intake.payer), "payer", 2);
  user("claim.number", strOrNull(intake.claimNumber), "claimNumber", 2);
  user("claim.dateOfService", strOrNull(intake.dateOfService), "dateOfService", 2);
  user("claim.billedAmount", strOrNull(intake.billedAmount), "billedAmount", 2);
  user("claim.paidAmount", strOrNull(intake.paidAmount), "paidAmount", 2);
  user("claim.deniedAmount", strOrNull(intake.deniedAmount), "deniedAmount", 2);
  user("claim.carcCodes", arrOrNull(intake.carcCodes), "carcCodes", 2);
  user("claim.rarcCodes", arrOrNull(intake.rarcCodes), "rarcCodes", 2);
  user("claim.cptCodes", arrOrNull(intake.cptCodes), "cptCodes", 2);
  user("claim.icd10Codes", icdArrOrNull(intake.icdCodes), "icdCodes", 3);
  user(
    "claim.modifiers",
    intake.modifiers?.trim()
      ? intake.modifiers
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : null,
    "modifiers",
    2
  );

  user("provider.name", strOrNull(intake.providerName), "providerName", 3);
  user("provider.npi", strOrNull(intake.providerNpi), "providerNpi", 3);
  user(
    "provider.addressBlock",
    strOrNull(intake.providerAddress),
    "providerAddress",
    3
  );
  user("provider.phone", strOrNull(intake.providerPhone), "providerPhone", 3);
  user("provider.fax", strOrNull(intake.providerFax), "providerFax", 3);

  user(
    "signer.name",
    strOrNull(intake.signerName || intake.providerName),
    "signerName",
    3
  );
  user("signer.title", strOrNull(intake.signerTitle), "signerTitle", 3);
  user(
    "signer.credentials",
    strOrNull(intake.signerCredentials),
    "signerCredentials",
    3
  );
  user(
    "signer.phone",
    strOrNull(intake.signerPhone || intake.providerPhone),
    "signerPhone",
    3
  );

  user("clinical.icd10Codes", icdArrOrNull(intake.icdCodes), "icdCodes", 3);
  user(
    "clinical.primaryDiagnosis",
    strOrNull(intake.primaryDiagnosis),
    "primaryDiagnosis",
    3
  );
  user(
    "clinical.indication",
    strOrNull(intake.medicalNecessity || intake.treatmentProvided),
    "indication",
    3
  );
  user(
    "clinical.procedureNarrative",
    strOrNull(intake.treatmentProvided),
    "procedureNarrative",
    3
  );
  user(
    "clinical.priorTreatments",
    strOrNull(intake.priorTreatments),
    "priorTreatments",
    3
  );
  user(
    "clinical.conservativeCareTried",
    strOrNull(intake.conservativeCareTried),
    "conservativeCareTried",
    3
  );
  user(
    "clinical.functionalImpact",
    strOrNull(intake.functionalImpact),
    "functionalImpact",
    3
  );
  user("clinical.urgency", strOrNull(intake.urgency), "urgency", 3);

  user(
    "claim.authorizationNumber",
    strOrNull(intake.authorizationNumber),
    "authorizationNumber",
    3
  );
  user(
    "appeal.authBranch",
    intake.authBranch ? intake.authBranch : null,
    "authBranch",
    3
  );
  user(
    "appeal.bundlingBranch",
    intake.bundlingBranch ? intake.bundlingBranch : null,
    "bundlingBranch",
    3
  );
  user(
    "appeal.timelyFilingBranch",
    intake.timelyFilingBranch ? intake.timelyFilingBranch : null,
    "timelyFilingBranch",
    3
  );
  user(
    "claim.goodCauseDescription",
    strOrNull(intake.goodCauseDescription),
    "goodCauseDescription",
    3
  );
  user(
    "patient.planType",
    intake.planType ? intake.planType : null,
    "planType",
    3
  );

  if (!ledger.facts["claim.deniedAmount"]?.value) {
    const b = parseFloat(String(intake.billedAmount || "").replace(/[$,\s]/g, ""));
    const p = parseFloat(String(intake.paidAmount || "").replace(/[$,\s]/g, ""));
    if (Number.isFinite(b) && Number.isFinite(p)) {
      ledger = setFact(
        ledger,
        "claim.deniedAmount",
        Math.max(0, b - p).toFixed(2),
        "derived",
        "derived:billed_amount-paid_amount",
        1
      );
    }
  }

  const enc =
    enclosures && enclosures.length
      ? enclosures
      : ledger.enclosures?.length
        ? ledger.enclosures
        : DEFAULT_ENCLOSURES.map((e) => ({
            id: e.id,
            label: e.label,
            checked: false,
          }));

  return {
    ...ledger,
    enclosures: enc,
    meta: {
      ...ledger.meta,
      ledgerVersion: 1,
    },
  };
}

export function ensureLedger(
  existing: FactLedger | null | undefined,
  intake: DenialIntake,
  enclosures?: EnclosureItem[]
): FactLedger {
  if (!existing) {
    return applyIntakeToLedger(emptyLedger(), intake, enclosures);
  }
  return applyIntakeToLedger(
    existing,
    intake,
    enclosures ?? existing.enclosures
  );
}

export function mergeDocumentLedger(
  documentLedger: FactLedger,
  userLedger: FactLedger
): FactLedger {
  return mergeLedger(documentLedger, userLedger);
}
