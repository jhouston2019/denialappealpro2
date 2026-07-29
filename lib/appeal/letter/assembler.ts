import { getValue } from "../ledger/builder";
import { CLINICAL_KEYS, FACT_LABELS } from "../ledger/keys";
import type {
  FactKey,
  FactLedger,
  FactValue,
  PlanType,
} from "../ledger/types";
import type { AuthorityRecord } from "../authorities/records";
import {
  formatCarc,
  formatCurrency,
  formatLetterDate,
  formatNpi,
  formatRarc,
} from "../format/render";
import { lookupCarc, routeDenial } from "../router/index";
import { appendEnclosuresBlock } from "./enclosures";
import { assembleSignatureBlock } from "./signature";

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

function isPresent(value: FactValue | undefined): value is FactValue {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function hasClinicalFacts(ledger: FactLedger): boolean {
  return CLINICAL_KEYS.some((key) => isPresent(getValue(ledger, key)));
}

function resolvePlanType(ledger: FactLedger): PlanType {
  const v = getValue(ledger, "patient.planType");
  const s = String(v ?? "").trim();
  const allowed: PlanType[] = [
    "erisa-self-funded",
    "fully-insured-group",
    "medicare-advantage",
    "medicaid-mco",
    "marketplace-individual",
    "medicare-traditional",
    "unknown",
  ];
  return (allowed.find((p) => p === s) ?? "unknown") as PlanType;
}

function formatDenialCodes(ledger: FactLedger): string {
  const carcCodes = arr(getValue(ledger, "claim.carcCodes"));
  const rarcCodes = arr(getValue(ledger, "claim.rarcCodes"));
  const carcParts = carcCodes.map((c) => {
    const entry = lookupCarc(c);
    return entry
      ? formatCarc(c, entry.descriptor)
      : formatCarc(c);
  });
  const rarcParts = rarcCodes.map((c) => formatRarc(c));
  const parts = [...carcParts, ...rarcParts].filter(Boolean);
  return parts.length ? parts.join(" / ") : req("claim.carcCodes");
}

/** Whitespace-normalize for verbatim authority comparison. */
export function normalizeAuthorityText(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sections 1–5: letterhead, date, payer address, RE block, salutation.
 */
export function buildScaffold(ledger: FactLedger): string {
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
  const payerName = orReq(
    str(getValue(ledger, "claim.payerName")),
    "claim.payerName"
  );
  const payerAddr = orReq(
    str(getValue(ledger, "claim.payerAppealAddress")),
    "claim.payerAppealAddress"
  );

  const appealLevel = str(getValue(ledger, "appeal.level")) || "First-level";
  const claim = orReq(str(getValue(ledger, "claim.number")), "claim.number");
  const patient = orReq(str(getValue(ledger, "patient.name")), "patient.name");
  const member = orReq(
    str(getValue(ledger, "patient.memberId")),
    "patient.memberId"
  );
  const groupName = str(getValue(ledger, "patient.groupName"));
  const groupNumber = str(getValue(ledger, "patient.groupNumber"));
  const dosRaw = str(getValue(ledger, "claim.dateOfService"));
  const dos = dosRaw ? formatLetterDate(dosRaw) : req("claim.dateOfService");
  const cptArr = arr(getValue(ledger, "claim.cptCodes"));
  const cpt = cptArr.length ? cptArr.join(", ") : req("claim.cptCodes");
  const billedRaw = str(getValue(ledger, "claim.billedAmount"));
  const billed = billedRaw
    ? formatCurrency(billedRaw)
    : req("claim.billedAmount");
  const deniedRaw = str(getValue(ledger, "claim.deniedAmount"));
  const denied = deniedRaw
    ? formatCurrency(deniedRaw)
    : req("claim.deniedAmount");
  const denialCodes = formatDenialCodes(ledger);
  const timelyDays = str(getValue(ledger, "claim.timelyFilingDays"));
  const timelyLine = timelyDays
    ? `    Timely Filing Deadline: ${timelyDays} days from DOS`
    : "";

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
    `Re: ${appealLevel} Appeal — Claim ${claim}`,
    `    Patient: ${patient} | Member ID: ${member}`,
    groupLine,
    `    DOS: ${dos}`,
    `    CPT: ${cpt} | Billed: ${billed}`,
    `    Denied: ${denied}`,
    `    Denial: ${denialCodes}`,
    timelyLine,
    "",
    "To the Appeals Review Department:",
    "",
  ].filter(Boolean);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Section 11 — authority argument paragraphs verbatim with citation and quotable. */
export function buildAuthorities(
  _ledger: FactLedger,
  authorities: AuthorityRecord[]
): string {
  if (!authorities.length) return "";

  const blocks = authorities.map((r) => {
    const quotableInArg = r.argument
      .toLowerCase()
      .includes(r.quotable.toLowerCase());
    const quotableLine = quotableInArg
      ? ""
      : `"${r.quotable}" `;
    return `${r.citation}\n\n${quotableLine}${r.argument}`;
  });

  return blocks.join("\n\n");
}

/** Section 12 — plan-type-specific procedural obligations. */
export function buildProcedural(
  ledger: FactLedger,
  planType?: PlanType
): string {
  const pt = planType ?? resolvePlanType(ledger);
  const claim = orReq(str(getValue(ledger, "claim.number")), "claim.number");

  if (pt === "erisa-self-funded") {
    return [
      "Procedural Obligations",
      "",
      `This appeal of claim ${claim} imposes the following procedural requirements on the plan under ERISA and the Department of Labor claims procedure regulation:`,
      "",
      "Under 29 C.F.R. § 2560.503-1(g), the plan must provide a specific reason for the adverse benefit determination and cite the specific plan provision relied upon. The denial must identify the applicable authorization criteria and explain how they were applied to this claim.",
      "",
      "The plan must assign this appeal to a reviewer who was not involved in the initial adverse determination and who has appropriate training and experience. The reviewer must not have a conflict of interest with respect to the claim.",
      "",
      "Pursuant to 29 C.F.R. § 2560.503-1(h)(2)(iii), the plan must provide, upon request and free of charge, all documents, records, and other information relevant to the claim for benefits, including the plan provision imposing any prior authorization requirement, authorization criteria applied, and the identity and qualifications of any clinical reviewer.",
      "",
      "The plan must issue a written decision within the timeframe required by § 2560.503-1(i). Failure to comply with these requirements constitutes a procedural defect subject to deemed exhaustion under § 2560.503-1(l).",
    ].join("\n");
  }

  if (pt === "fully-insured-group" || pt === "marketplace-individual") {
    return [
      "Procedural Obligations",
      "",
      `This fully insured appeal of claim ${claim} is subject to state insurance law and ACA external review requirements:`,
      "",
      "The plan must provide a written adverse benefit determination that includes the specific reason for denial and reference to the plan provision or coverage policy relied upon.",
      "",
      "The enrollee has the right to request an independent external review under 45 C.F.R. § 147.136 if this internal appeal is denied.",
      "",
      "Applicable state prompt-pay and claims processing standards require timely adjudication of this appeal. Denial without a reasoned, documented response violates the plan's obligations to the enrollee and the state regulator.",
    ].join("\n");
  }

  if (pt === "medicare-advantage") {
    return [
      "Procedural Obligations",
      "",
      `This Medicare Advantage appeal of claim ${claim} is governed by 42 C.F.R. Part 422, Subpart M:`,
      "",
      "The MA organization must provide a meaningful appeals process and may not apply coverage criteria more restrictive than traditional Medicare.",
      "",
      "If this appeal is denied, the enrollee has the right to an automatic Independent Review Entity (IRE) review by the Quality Improvement Organization. Expedited review must be completed within 72 hours when the standard for expedited review is met; standard review within 30 days.",
      "",
      "The plan must forward the case to the IRE when required and provide the enrollee notice of appeal rights at each level.",
    ].join("\n");
  }

  if (pt === "medicaid-mco") {
    return [
      "Procedural Obligations",
      "",
      `This Medicaid managed care appeal of claim ${claim} is subject to 42 C.F.R. Part 438, Subpart F:`,
      "",
      "The MCO must provide a grievance and appeal system meeting federal standards, including notice of the reason for denial and the right to a state fair hearing.",
      "",
      "The enrollee has the right to continue receiving benefits pending the outcome of this appeal when applicable under state Medicaid rules.",
      "",
      "Failure to resolve this appeal within the regulatory timeframe may constitute a violation of the plan's contract with the state Medicaid agency.",
    ].join("\n");
  }

  return [
    "Procedural Obligations",
    "",
    `We submit this appeal of claim ${claim} pursuant to the plan's internal appeals procedures. The plan must provide a written response stating the specific basis for any continued denial and the enrollee's remaining appeal rights.`,
  ].join("\n");
}

/** Section 13 — plan-type-specific escalation ladder. */
export function buildEscalation(
  ledger: FactLedger,
  planType?: PlanType
): string {
  const pt = planType ?? resolvePlanType(ledger);
  const today = formatLetterDate(new Date().toISOString().slice(0, 10));
  const deadlineRaw = str(getValue(ledger, "appeal.deadline"));
  const deadlineNote = deadlineRaw
    ? ` The internal appeal deadline is ${formatLetterDate(deadlineRaw)}.`
    : "";

  if (pt === "erisa-self-funded") {
    return [
      "Escalation",
      "",
      `If this appeal is not resolved favorably within the plan's required response period${deadlineNote ? deadlineNote : ", we will pursue all available remedies."}`,
      "",
      `Step 1 — Internal appeal: This letter initiates the internal appeal process as of ${today}.`,
      "",
      "Step 2 — External review: If denied, we will request independent external review under 45 C.F.R. § 147.136 within four months of the final internal adverse benefit determination.",
      "",
      "Step 3 — Civil action: We expressly reserve the right to bring a civil action under ERISA § 502(a)(1)(B), 29 U.S.C. § 1132(a)(1)(B), to recover benefits due under the terms of the plan. The administrative record compiled through this appeal will constitute the evidentiary record for any subsequent federal court proceeding.",
    ].join("\n");
  }

  if (pt === "fully-insured-group" || pt === "marketplace-individual") {
    const stateHint = str(getValue(ledger, "provider.addressBlock")).match(
      /\b([A-Z]{2})\s+\d{5}/
    )?.[1];
    const doiLine = stateHint
      ? `Step 3 — State Department of Insurance: We will file a complaint with the ${stateHint} Department of Insurance if the plan fails to comply with state external review and prompt-pay requirements.`
      : "Step 3 — State Department of Insurance: We will file a complaint with the applicable state Department of Insurance if the plan fails to comply with state external review and prompt-pay requirements.";

    return [
      "Escalation",
      "",
      `If this appeal is not resolved favorably${deadlineNote}, we will escalate as follows:`,
      "",
      `Step 1 — Internal appeal: This letter initiates the internal appeal process as of ${today}.`,
      "",
      "Step 2 — State external review: If denied, we will request independent external review under 45 C.F.R. § 147.136 and applicable state external review law.",
      "",
      doiLine,
    ].join("\n");
  }

  if (pt === "medicare-advantage") {
    return [
      "Escalation",
      "",
      `If this appeal is not resolved favorably${deadlineNote}, we will escalate through the Medicare appeals process:`,
      "",
      `Step 1 — Plan reconsideration: This letter initiates reconsideration as of ${today}.`,
      "",
      "Step 2 — Independent Review Entity (IRE): If denied, the case must be forwarded to the Quality Improvement Organization for IRE review. Expedited IRE review is available within 72 hours when criteria are met.",
      "",
      "Step 3 — Administrative Law Judge (ALJ) hearing, Medicare Appeals Council review, and federal district court review as permitted under the Medicare appeals regulations.",
    ].join("\n");
  }

  if (pt === "medicaid-mco") {
    return [
      "Escalation",
      "",
      `If this appeal is not resolved favorably${deadlineNote}, we will escalate as follows:`,
      "",
      `Step 1 — MCO internal appeal: This letter initiates the internal appeal as of ${today}.`,
      "",
      "Step 2 — State fair hearing: If denied, we will request a fair hearing before the state Medicaid agency.",
      "",
      "Step 3 — Continuation of benefits and judicial review as permitted under state Medicaid law and 42 C.F.R. Part 438.",
    ].join("\n");
  }

  return [
    "Escalation",
    "",
    `If this appeal is not resolved favorably${deadlineNote}, we will pursue internal appeal exhaustion and any available external review or further escalation as appropriate under the plan's appeal procedures.`,
  ].join("\n");
}

/** Section 15 — signature block. */
export function buildSignature(ledger: FactLedger): string {
  return assembleSignatureBlock(ledger);
}

/** Strip model salutation / signature so only narrative sections 6–10 remain. */
export function extractNarrativeBody(modelText: string): string {
  let t = String(modelText || "").trim();
  t = t.replace(/^[\s\S]*?(?=To the Appeals Review Department[:]?)/i, "");
  t = t.replace(/^To the Appeals Review Department:?\s*\n+/i, "").trim();
  t = t.replace(/\nSincerely,?[\s\S]*$/i, "").trim();
  return t;
}

export interface AssembledLetterParts {
  scaffold: string;
  narrative: string;
  authorities: string;
  procedural: string;
  escalation: string;
  signature: string;
  full: string;
}

/** Canonical assembly: scaffold + narrative + authorities + procedural + escalation + signature + enclosures. */
export function assembleLetter(
  ledger: FactLedger,
  narrativeBody: string,
  authorities: AuthorityRecord[]
): string {
  const parts = assembleLetterParts(ledger, narrativeBody, authorities);
  return parts.full;
}

export function assembleLetterParts(
  ledger: FactLedger,
  narrativeBody: string,
  authorities: AuthorityRecord[]
): AssembledLetterParts {
  const planType = resolvePlanType(ledger);
  const scaffold = buildScaffold(ledger);
  const narrative = extractNarrativeBody(narrativeBody);
  const authSection = buildAuthorities(ledger, authorities);
  const procedural = buildProcedural(ledger, planType);
  const escalation = buildEscalation(ledger, planType);
  const signature = buildSignature(ledger);

  const sections = [
    scaffold.trimEnd(),
    narrative.trim(),
    authSection.trim(),
    procedural.trim(),
    escalation.trim(),
    signature.trim(),
  ].filter((s) => s.length > 0);

  let full = sections.join("\n\n");
  full = appendEnclosuresBlock(full, ledger.enclosures || []);

  return {
    scaffold,
    narrative,
    authorities: authSection,
    procedural,
    escalation,
    signature,
    full,
  };
}

/** Spec for LLM — sections 6–10 only. */
export function narrativeSectionSpec(ledger: FactLedger): string {
  const route = routeDenial(ledger);
  const clinical = hasClinicalFacts(ledger);
  const strategyId = route.strategy.id;

  const lines = [
    "Write ONLY the following narrative sections (plain text, double newline between sections):",
    "",
    "6. RELIEF REQUESTED — One sentence stating what we want (reprocess / reverse / pay at contracted rate). Never demand payment equal to billed charges.",
    "7. CLAIM SUMMARY — Factual summary: claim number, dates, codes, amounts from ledger only.",
    "8. DENIAL BASIS — CARC descriptor verbatim from CARC DESCRIPTOR below. RARC if available. No inference.",
  ];

  if (strategyId === "medical-necessity") {
    lines.push(
      "9. CLINICAL ARGUMENT — All populated clinical.* facts from ledger. This section leads the rebuttal. No expansion beyond ledger content.",
      "",
      "10. STRATEGY ARGUMENT — Medical necessity rebuttal. Structure:",
      "Paragraph 1 — Lead: State that the payer's necessity determination is not supported by the clinical record. Do not restate the denial reason; challenge it directly.",
      "Paragraph 2 — Criteria match: Using only clinical facts in the ledger, show the patient satisfies coverage criteria. Cite diagnosis, failed conservative care, and functional impact explicitly.",
      "Paragraph 3 — Payer's burden: The plan's denial must identify the specific clinical criterion the service fails to satisfy. A conclusory determination without specifying the unmet criterion does not constitute a valid adverse benefit determination."
    );
  } else if (strategyId === "bundling") {
    lines.push(
      "9. BUNDLING ARGUMENT — Structure:",
      "Paragraph 1 — Lead: The services are distinct and separately reimbursable.",
      "Paragraph 2 — Branch argument: Use the BRANCH ARGUMENT text from the strategy block verbatim as the basis; expand only with ledger facts.",
      "Paragraph 3 — Payer's burden: The plan must identify the specific NCCI edit or coverage policy requiring bundling. A bundling denial without citing the edit number and modifier indicator is not a valid coding determination.",
      "",
      "10. CLINICAL ARGUMENT — Omit unless clinical.* facts are present in the ledger."
    );
    if (clinical) {
      lines[lines.length - 1] =
        "10. CLINICAL ARGUMENT — Include populated clinical.* facts only if relevant to the bundling argument.";
    }
  } else if (strategyId === "timely-filing") {
    lines.push(
      "9. TIMELY FILING ARGUMENT — Structure:",
      "Paragraph 1 — Lead: The denial is not supported by the submission record.",
      "Paragraph 2 — Branch argument: Use the BRANCH ARGUMENT text from the strategy block as the basis.",
      "Paragraph 3 — Payer's burden: The plan must produce evidence the claim was not submitted within the applicable period.",
      "",
      "10. CLINICAL ARGUMENT — Omit entirely."
    );
  } else {
    lines.push(
      "9. STRATEGY ARGUMENT — Follow DENIAL STRATEGY and branch lead argument exactly."
    );
    if (clinical) {
      lines.push(
        "10. CLINICAL ARGUMENT — All populated clinical.* facts from ledger. No expansion beyond ledger content."
      );
    } else {
      lines.push("10. CLINICAL ARGUMENT — Omit entirely (no clinical.* facts in ledger).");
    }
    if (strategyId === "authorization" && route.branch?.id === "D") {
      lines.push(
        "   Branch D threads: (1) retroactive authorization, (2) notice/waiver, (3) disproportionate remedy."
      );
    }
  }

  lines.push(
    "",
    "Do NOT write letterhead, date, payer address, Re: block, salutation, authority citations, procedural obligations, escalation, enclosures, or signature.",
    "Do NOT label sections with headers (e.g., \"RELIEF REQUESTED\" or \"CLAIM SUMMARY\") — write flowing paragraphs only."
  );
  return lines.join("\n");
}

export { hasClinicalFacts, resolvePlanType };
