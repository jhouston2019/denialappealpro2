import { getValue, missingRequired } from "../ledger/builder";
import { ALWAYS_REQUIRED, CLINICAL_KEYS } from "../ledger/keys";
import type { FactKey, FactLedger, FactValue, PlanType } from "../ledger/types";
import {
  formatCarc,
  formatCurrency,
  formatLetterDate,
  formatNpi,
  formatRarc,
} from "../format/render";
import { isDateShapedString } from "../letter/signature";
import {
  inconsistentCharacterizations,
  routeDenial,
} from "../router/index";
import {
  allowedCitationNeedles,
  getAuthorities,
  normalizePayerSlug,
} from "../authorities/gate";
import {
  CORE_ERISA_AUTHORITY_IDS,
  AUTHORITY_RECORDS,
  getRecordById,
} from "../authorities/records";
import { normalizeAuthorityText } from "../letter/assembler";
import {
  collectCitationHits,
  findUnapprovedCitations,
  isApprovedHit,
} from "./citations";

export interface ValidationError {
  rule: string;
  message: string;
  factKey?: FactKey;
  wizardStep?: 2 | 3 | 4;
  severity?: "error" | "warning";
}

const PLACEHOLDER_RE = /\[\[REQUIRED:[^\]]+\]\]/g;

const ENCLOSURE_REF_RE =
  /\b(enclosed\s+herewith|enclosed\s+please\s+find|attached\s+please\s+find|attached\s+hereto|please\s+find\s+attached|accompanying\s+documents?|enclosed\s+is|enclosed\s+are|see\s+attached|as\s+attached|\benclosed\b|\bherewith\b|\battached\b|please\s+find)\b/gi;

const BREACH_RE =
  /\b(breach(?:es|ed|ing)?|violat(?:e|es|ed|ing|ion|ions)|participation\s+agreement)\b/gi;

const INTERNAL_ROUTING_RE =
  /\b(authorization status branch|branch a\b|branch b\b|branch c\b|branch d\b|strategy id|section order|generatorpath|under plan type|plan type erisa|plan type fully-insured|plan type medicare|plan type medicaid|plan type marketplace|plan type unknown)\b|(?:erisa-self-funded|fully-insured-group|medicare-advantage|medicaid-mco|marketplace-individual|medicare-traditional)\b/gi;

const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

const RELIEF_RE =
  /\b(reprocess(?:ed|ing)?|reverse|overturn|pay(?:ment|able)?|reconsider(?:ation)?|remit(?:tance)?)\b/i;

const ESCALATION_RE =
  /\b(escalation|external review|civil action|fair hearing|independent review|IRE\b|§\s*502\(a\)|502\(a\))\b/i;

function citationPresent(body: string, citation: string): boolean {
  const hay = body.toLowerCase();
  const cite = citation.trim().toLowerCase();
  if (hay.includes(cite)) return true;
  const parts = citation
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 8);
  return parts.length > 0 && parts.every((p) => hay.includes(p.toLowerCase()));
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

const INTERNAL_GROUNDING_RE =
  /\b(no clinical narrative|not offered|beyond the procedure code|as billed\.|ledger|provenance|not present in the source|no information (was )?(provided|available))\b/gi;

/** Minimum clinical assertion terms for clinical_claims_grounded. */
export const CLINICAL_ASSERTION_RE =
  /\b(osteoarthritis|emergent|urgent|conservative\s+(?:management|care)|functional\s+impairment|medically\s+necessary|failed\s+treatment|chronic\s+pain|degenerative|refractory|intraoperative)\b/gi;

function isPresent(value: FactValue | undefined): value is FactValue {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function allClinicalNull(ledger: FactLedger): boolean {
  return CLINICAL_KEYS.every((key) => !isPresent(getValue(ledger, key)));
}

/** Body text only — strip trailing Enclosures: block before enclosure-ref scan. */
export function letterBodyWithoutEnclosuresBlock(text: string): string {
  return String(text || "").replace(/\n\s*Enclosures:\s*\n[\s\S]*$/i, "");
}

function extractSignerSlotLines(text: string): string[] {
  const body = letterBodyWithoutEnclosuresBlock(text);
  const m = body.match(/\nSincerely,?\s*\n([\s\S]*)$/i);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function extractFirstNarrativeParagraph(text: string): string {
  const body = letterBodyWithoutEnclosuresBlock(text);
  const m = body.match(
    /To the Appeals Review Department:?\s*\n+([\s\S]*?)(?:\n\s*\n|$)/i
  );
  return (m?.[1] ?? "").trim();
}

const NECESSITY_LEAD_RE =
  /\b(medical necessity|medically necessary|not medically necessary|medical necessity denial|denied for medical necessity)\b/i;

const PROCEDURAL_TIMELY_RE =
  /\b(timely filing|filed within|filing limit|filing deadline|adhered to the timely|within the required timeframe)\b/i;

const PROCEDURAL_AUTH_COMPLIANCE_RE =
  /\b(authorization (?:number )?(?:is )?on file|auth(?:orization)? (?:was )?obtained|prior authorization (?:was )?obtained|precertification (?:was )?obtained)\b/i;

const PROCEDURAL_COMPLETENESS_RE =
  /\b(submitted with all (?:necessary|required)|all necessary (?:details|information)|complete(?:ness)? of (?:the )?information|claim was complete)\b/i;

export function validateLetter(
  letterText: string,
  ledger: FactLedger
): ValidationError[] {
  const errors: ValidationError[] = [];
  const text = String(letterText || "");
  const body = letterBodyWithoutEnclosuresBlock(text);

  // 1. placeholders
  const placeholders = text.match(PLACEHOLDER_RE) || [];
  for (const token of placeholders) {
    errors.push({
      rule: "no_unresolved_placeholders",
      message: `Unresolved required fact placeholder: ${token}`,
      wizardStep: 3,
    });
  }

  // 2. missing required facts
  for (const key of missingRequired(ledger)) {
    errors.push({
      rule: "no_missing_required_facts",
      message: `Missing required fact: ${key}`,
      factKey: key,
      wizardStep:
        key.startsWith("provider.") || key.startsWith("signer.")
          ? 3
          : key.startsWith("clinical.")
            ? 3
            : 2,
    });
  }

  // 3. unapproved citations
  for (const hit of findUnapprovedCitations(text, ledger)) {
    errors.push({
      rule: "no_unapproved_citations",
      message: `Unapproved citation-shaped text: "${hit}"`,
      wizardStep: 4,
    });
  }

  // 4. enclosure references in body
  ENCLOSURE_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const seenEnc = new Set<string>();
  while ((m = ENCLOSURE_REF_RE.exec(body)) !== null) {
    const phrase = m[0];
    if (seenEnc.has(phrase.toLowerCase())) continue;
    seenEnc.add(phrase.toLowerCase());
    errors.push({
      rule: "no_enclosure_reference_in_body",
      message: `Letter body must not reference enclosures ("${phrase}")`,
      wizardStep: 4,
    });
  }

  // 5. signature_block_not_date
  const signerName = getValue(ledger, "signer.name");
  if (!isPresent(signerName)) {
    errors.push({
      rule: "signature_block_not_date",
      message: "signer.name is null — signature block cannot be bound",
      factKey: "signer.name",
      wizardStep: 3,
    });
  } else if (isDateShapedString(signerName)) {
    errors.push({
      rule: "signature_block_not_date",
      message: `signer.name is date-shaped ("${String(signerName)}")`,
      factKey: "signer.name",
      wizardStep: 3,
    });
  } else {
    const signerLines = extractSignerSlotLines(text);
    if (signerLines.length && isDateShapedString(signerLines[0])) {
      errors.push({
        rule: "signature_block_not_date",
        message: `Signature slot resolves to a date-shaped string ("${signerLines[0]}")`,
        factKey: "signer.name",
        wizardStep: 4,
      });
    }
  }

  // 6. clinical_claims_grounded
  if (allClinicalNull(ledger)) {
    CLINICAL_ASSERTION_RE.lastIndex = 0;
    const hits = new Set<string>();
    let cm: RegExpExecArray | null;
    while ((cm = CLINICAL_ASSERTION_RE.exec(body)) !== null) {
      hits.add(cm[0]);
    }
    for (const hit of hits) {
      errors.push({
        rule: "clinical_claims_grounded",
        message: `Clinical assertion "${hit}" with no clinical.* facts in ledger`,
        wizardStep: 3,
      });
    }
  }

  // 7. no_contract_breach_allegation
  BREACH_RE.lastIndex = 0;
  const breachHits = new Set<string>();
  let bm: RegExpExecArray | null;
  while ((bm = BREACH_RE.exec(body)) !== null) {
    breachHits.add(bm[0]);
  }
  for (const hit of breachHits) {
    errors.push({
      rule: "no_contract_breach_allegation",
      message: `Contract/legal allegation language: "${hit}"`,
      wizardStep: 4,
    });
  }

  // 8. no_internal_grounding_language
  INTERNAL_GROUNDING_RE.lastIndex = 0;
  const groundHits = new Set<string>();
  let gm: RegExpExecArray | null;
  while ((gm = INTERNAL_GROUNDING_RE.exec(body)) !== null) {
    groundHits.add(gm[0]);
  }
  for (const hit of groundHits) {
    errors.push({
      rule: "no_internal_grounding_language",
      message: `Internal grounding language in letter body: "${hit}"`,
      wizardStep: 4,
    });
  }

  // 8b. icd10_codes_required — required after Step 3 (document extraction or manual entry)
  const icdClaim = getValue(ledger, "claim.icd10Codes");
  const icdClinical = getValue(ledger, "clinical.icd10Codes");
  const icdValue = isPresent(icdClaim)
    ? icdClaim
    : isPresent(icdClinical)
      ? icdClinical
      : null;
  if (!isPresent(icdValue)) {
    errors.push({
      rule: "icd10_codes_required",
      message: "ICD-10 diagnosis code(s) are required before letter export",
      factKey: "claim.icd10Codes",
      wizardStep: 3,
    });
  } else {
    const needles = renderNeedles("claim.icd10Codes", icdValue);
    const hay = text.toLowerCase();
    const found = needles.some((n) => n && hay.includes(n.toLowerCase()));
    if (!found) {
      errors.push({
        rule: "icd10_codes_rendered",
        message: "ICD-10 code(s) are populated but not rendered in the letter",
        factKey: "claim.icd10Codes",
        wizardStep: 4,
      });
    }
  }

  // 8c. signature_provider_fields — closing block must include provider identity
  const sigMatch = text.match(/\nSincerely,?\s*\n([\s\S]*?)(?:\n\s*Enclosures:|$)/i);
  if (sigMatch) {
    const sigBlock = sigMatch[1];
    const npiRaw = String(getValue(ledger, "provider.npi") ?? "").replace(/\D/g, "");
    if (npiRaw && !sigBlock.includes(npiRaw)) {
      errors.push({
        rule: "signature_provider_npi",
        message: "Signature block must include provider NPI",
        factKey: "provider.npi",
        wizardStep: 3,
      });
    }
    const providerName = String(getValue(ledger, "provider.name") ?? "").trim();
    if (providerName && !sigBlock.toLowerCase().includes(providerName.toLowerCase())) {
      errors.push({
        rule: "signature_provider_name",
        message: "Signature block must include provider/practice name",
        factKey: "provider.name",
        wizardStep: 3,
      });
    }
  }

  // 9. all_required_facts_rendered — every non-null ALWAYS_REQUIRED value must appear
  for (const key of ALWAYS_REQUIRED) {
    const v = getValue(ledger, key);
    if (!isPresent(v)) continue;
    const needles = renderNeedles(key, v);
    const hay = text.toLowerCase();
    const found = needles.some((n) => n && hay.includes(n.toLowerCase()));
    if (!found) {
      errors.push({
        rule: "all_required_facts_rendered",
        message: `Required fact ${key} is populated but not rendered in the letter`,
        factKey: key,
        wizardStep: 4,
      });
    }
  }

  const route = routeDenial(ledger);
  const opening = extractFirstNarrativeParagraph(text);
  const primaryAdmin = route.primaryCarc?.isAdministrative ?? false;

  // 10. auth_branch_selected
  if (
    route.strategy.id === "authorization" &&
    !getValue(ledger, "appeal.authBranch")
  ) {
    errors.push({
      rule: "auth_branch_selected",
      message:
        "Authorization strategy requires appeal.authBranch (A/B/C/D) before generation",
      factKey: "appeal.authBranch",
      wizardStep: 3,
    });
  }

  // 10b. bundling_branch_selected
  if (
    route.resolvedStrategies.includes("bundling") &&
    route.strategy.id === "bundling" &&
    !getValue(ledger, "appeal.bundlingBranch")
  ) {
    errors.push({
      rule: "bundling_branch_selected",
      message:
        "Bundling strategy requires appeal.bundlingBranch before generation",
      factKey: "appeal.bundlingBranch",
      wizardStep: 3,
    });
  }

  // 10c. timely_filing_branch_selected
  if (
    route.strategy.id === "timely-filing" &&
    !getValue(ledger, "appeal.timelyFilingBranch")
  ) {
    errors.push({
      rule: "timely_filing_branch_selected",
      message:
        "Timely filing strategy requires appeal.timelyFilingBranch before generation",
      factKey: "appeal.timelyFilingBranch",
      wizardStep: 3,
    });
  }

  // 11. strategy_matches_primary_carc / no_necessity_lead_on_admin_denial
  if (primaryAdmin && route.strategy.id !== "medical-necessity") {
    if (NECESSITY_LEAD_RE.test(opening)) {
      errors.push({
        rule: "no_necessity_lead_on_admin_denial",
        message:
          "Opening paragraph leads with medical necessity language on an administrative denial",
        wizardStep: 4,
      });
      errors.push({
        rule: "strategy_matches_primary_carc",
        message:
          "Letter leads with medical necessity argument when primary CARC is administrative",
        wizardStep: 4,
      });
    }
  }

  // 12. carc_descriptor_accurate
  if (route.primaryCarc) {
    for (const phrase of inconsistentCharacterizations(
      route.primaryCarc.descriptor,
      body
    )) {
      errors.push({
        rule: "carc_descriptor_accurate",
        message: `Denial mischaracterized as "${phrase}" — inconsistent with CARC descriptor`,
        wizardStep: 4,
      });
    }
  }

  // 13. procedural_assertions_grounded
  if (PROCEDURAL_TIMELY_RE.test(body) && !isPresent(getValue(ledger, "claim.timelyFilingDays"))) {
    errors.push({
      rule: "procedural_assertions_grounded",
      message:
        "Letter asserts timely filing compliance without claim.timelyFilingDays in ledger",
      factKey: "claim.timelyFilingDays",
      wizardStep: 3,
    });
  }
  if (
    PROCEDURAL_AUTH_COMPLIANCE_RE.test(body) &&
    !isPresent(getValue(ledger, "claim.authorizationNumber"))
  ) {
    errors.push({
      rule: "procedural_assertions_grounded",
      message:
        "Letter asserts authorization compliance without claim.authorizationNumber in ledger",
      factKey: "claim.authorizationNumber",
      wizardStep: 3,
    });
  }
  if (PROCEDURAL_COMPLETENESS_RE.test(body) && primaryAdmin) {
    const hasDefectStrategy = route.strategy.id === "claim-defect";
    if (!hasDefectStrategy) {
      errors.push({
        rule: "procedural_assertions_grounded",
        message:
          "Letter asserts claim completeness without a ledger fact supporting submission completeness",
        wizardStep: 4,
      });
    }
  }

  const planType = resolvePlanType(ledger);
  const authBranch = getValue(ledger, "appeal.authBranch");
  const authorities = getAuthorities(
    planType,
    route.strategy.id,
    authBranch ? String(authBranch) : undefined,
    ledger
  );
  const allowedNeedles = allowedCitationNeedles(authorities);

  // 14. plan_type_selected
  if (!isPresent(getValue(ledger, "patient.planType"))) {
    errors.push({
      rule: "plan_type_selected",
      message: "patient.planType must be selected before generation",
      factKey: "patient.planType",
      wizardStep: 3,
    });
  }

  // 15. no_blocked_authority
  for (const rec of AUTHORITY_RECORDS) {
    if (!rec.blocked.includes(planType)) continue;
    const hay = body.toLowerCase();
    const needles = [rec.citation, rec.shortLabel, ...rec.citation.split(/[;,]/)];
    for (const n of needles) {
      const t = n.trim();
      if (t.length >= 6 && hay.includes(t.toLowerCase())) {
        errors.push({
          rule: "no_blocked_authority",
          message: `Blocked authority citation for plan type ${planType}: "${t}"`,
          wizardStep: 4,
        });
        break;
      }
    }
  }

  // 16. no_invented_authority
  for (const hit of collectCitationHits(body)) {
    if (!isApprovedHit(hit, allowedNeedles)) {
      errors.push({
        rule: "no_invented_authority",
        message: `Citation not in returned authority records: "${hit}"`,
        wizardStep: 4,
      });
    }
  }

  // 17. erisa_arguments_complete
  if (planType === "erisa-self-funded") {
    for (const id of CORE_ERISA_AUTHORITY_IDS) {
      const rec = getRecordById(id);
      if (!rec) continue;
      if (!citationPresent(body, rec.citation)) {
        errors.push({
          rule: "erisa_arguments_complete",
          message: `Missing core ERISA authority citation: ${rec.citation}`,
          wizardStep: 4,
        });
      }
    }
  }

  // 18. unknown_plan_no_citations (warning not error per spec - use wizardStep 3 warning style)
  if (planType === "unknown" && collectCitationHits(body).length > 0) {
    errors.push({
      rule: "unknown_plan_no_citations",
      message:
        "Plan type is unknown — letter must not contain regulatory citations",
      factKey: "patient.planType",
      wizardStep: 3,
    });
  }

  // 19. internal_routing_language
  INTERNAL_ROUTING_RE.lastIndex = 0;
  const routeHits = new Set<string>();
  let rm: RegExpExecArray | null;
  while ((rm = INTERNAL_ROUTING_RE.exec(body)) !== null) {
    routeHits.add(rm[0]);
  }
  for (const hit of routeHits) {
    errors.push({
      rule: "internal_routing_language",
      message: `Internal routing language in letter body: "${hit}"`,
      wizardStep: 4,
    });
  }

  // 20. no_iso_dates
  ISO_DATE_RE.lastIndex = 0;
  const isoHits = body.match(ISO_DATE_RE) || [];
  for (const hit of isoHits) {
    errors.push({
      rule: "no_iso_dates",
      message: `ISO date format in letter body: "${hit}" — use "Month DD, YYYY"`,
      wizardStep: 4,
    });
  }

  // 21. relief_requested_first
  const firstPara = extractFirstNarrativeParagraph(text);
  if (firstPara && !RELIEF_RE.test(firstPara)) {
    errors.push({
      rule: "relief_requested_first",
      message:
        "First narrative paragraph must contain a relief request (reprocess / reverse / pay / reconsider)",
      wizardStep: 4,
    });
  }

  // 22. no_billed_charges_demand
  const billedRaw = getValue(ledger, "claim.billedAmount");
  if (isPresent(billedRaw)) {
    const billedFormatted = formatCurrency(String(billedRaw));
    const sentences = text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (!sentence.includes(billedFormatted)) continue;
      if (!/\b(pay(?:ment)?|demand(?:s|ing)?|remit(?:tance)?|owed|entitled to)\b/i.test(sentence)) {
        continue;
      }
      if (!/\bcontracted rate\b/i.test(sentence)) {
        errors.push({
          rule: "no_billed_charges_demand",
          message: `Letter demands payment of billed charges (${billedFormatted}) rather than contracted rate`,
          wizardStep: 4,
        });
        break;
      }
    }
  }

  // 23. escalation_ladder_present
  if (!ESCALATION_RE.test(text) && !/\bEscalation\b/i.test(text)) {
    errors.push({
      rule: "escalation_ladder_present",
      message: "Letter contains no escalation language",
      wizardStep: 4,
    });
  }

  // 24. escalation_plan_correct
  if (planType === "erisa-self-funded") {
    if (!/§\s*502\(a\)|502\(a\)|1132\(a\)/i.test(text)) {
      errors.push({
        rule: "escalation_plan_correct",
        message: "ERISA letter lacks § 502(a) civil action reference in escalation ladder",
        wizardStep: 4,
      });
    }
  } else if (planType === "medicare-advantage") {
    if (!/\bIRE\b|Independent Review Entity/i.test(text)) {
      errors.push({
        rule: "escalation_plan_correct",
        message: "Medicare Advantage letter lacks IRE reference in escalation ladder",
        wizardStep: 4,
      });
    }
  }

  // 25. payer_policy_present_when_eligible
  const payerSlug = normalizePayerSlug(String(getValue(ledger, "claim.payerName") ?? ""));
  const payerPolicies = authorities.filter((r) => r.payer);
  if (payerSlug && payerPolicies.length) {
    for (const pol of payerPolicies) {
      const normArg = normalizeAuthorityText(pol.argument);
      if (!normalizeAuthorityText(text).includes(normArg)) {
        errors.push({
          rule: "payer_policy_present_when_eligible",
          message: `Eligible payer policy omitted: ${pol.shortLabel}`,
          wizardStep: 4,
        });
      }
    }
  }

  // 26. authority_text_verbatim
  const normLetter = normalizeAuthorityText(text);
  for (const rec of authorities) {
    const normArg = normalizeAuthorityText(rec.argument);
    if (normArg && !normLetter.includes(normArg)) {
      errors.push({
        rule: "authority_text_verbatim",
        message: `Authority argument not verbatim: ${rec.id}`,
        wizardStep: 4,
      });
    }
  }

  // 27. necessity_denial_requires_diagnosis
  if (
    route.strategy.id === "medical-necessity" &&
    !isPresent(getValue(ledger, "clinical.primaryDiagnosis"))
  ) {
    errors.push({
      rule: "necessity_denial_requires_diagnosis",
      message:
        "Medical necessity appeal requires clinical.primaryDiagnosis before generation",
      factKey: "clinical.primaryDiagnosis",
      wizardStep: 3,
    });
  }

  // 28. necessity_criteria_match_present
  if (route.strategy.id === "medical-necessity") {
    const populatedClinical = CLINICAL_KEYS.filter((key) =>
      isPresent(getValue(ledger, key))
    );
    if (populatedClinical.length > 0) {
      const hay = body.toLowerCase();
      const referenced = populatedClinical.some((key) => {
        const v = getValue(ledger, key);
        if (!isPresent(v)) return false;
        const needles = renderNeedles(key, v as FactValue);
        return needles.some((n) => n && hay.includes(n.toLowerCase()));
      });
      if (!referenced) {
        errors.push({
          rule: "necessity_criteria_match_present",
          message:
            "Medical necessity letter must explicitly reference clinical facts from the ledger",
          wizardStep: 4,
        });
      }
    }
  }

  // 29. no_conclusory_necessity_challenge
  if (route.strategy.id === "medical-necessity") {
    const conclusory =
      /\b(medically necessary|medical necessity|service is necessary)\b/i.test(body);
    const criteriaArg =
      /\b(conservative|functional|diagnosis|criterion|criteria|clinical record|failed)\b/i.test(
        body
      );
    if (conclusory && !criteriaArg) {
      errors.push({
        rule: "no_conclusory_necessity_challenge",
        message:
          "Medical necessity letter must argue criteria match, not conclusory necessity language alone",
        wizardStep: 4,
      });
    }
  }

  // 30. timely_filing_proof_grounded (warning)
  const tfBranch = String(getValue(ledger, "appeal.timelyFilingBranch") ?? "");
  if (
    route.strategy.id === "timely-filing" &&
    tfBranch === "proof-of-timely-submission"
  ) {
    const proofChecked = (ledger.enclosures || []).some(
      (e) => e.checked && e.id === "timely_filing_proof"
    );
    if (!proofChecked) {
      errors.push({
        rule: "timely_filing_proof_grounded",
        message:
          "Proof-of-timely-submission branch selected but timely filing proof enclosure is not checked",
        wizardStep: 3,
        severity: "warning",
      });
    }
  }

  return errors;
}

function renderNeedles(key: FactKey, value: FactValue): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => renderNeedles(key, item));
  }
  const raw = String(value).trim();
  if (!raw) return [];
  const out = [raw];
  if (key.includes("Amount") || key.includes("billed") || key.includes("denied") || key.includes("paid") || key.includes("allowed")) {
    out.push(formatCurrency(raw));
    out.push(raw.replace(/\.00$/, ""));
  }
  if (key.toLowerCase().includes("date") || key === "claim.dateOfService") {
    out.push(formatLetterDate(raw));
  }
  if (key === "claim.carcCodes" || key.endsWith("carcCodes")) {
    out.push(formatCarc(raw));
    out.push(raw.replace(/\D/g, ""));
  }
  if (key === "claim.rarcCodes" || key.endsWith("rarcCodes")) {
    out.push(formatRarc(raw));
  }
  if (key === "claim.icd10Codes" || key === "clinical.icd10Codes") {
    out.push(raw.toUpperCase());
  }
  if (key === "patient.planType") {
    out.push(raw.replace(/-/g, " "));
  }
  if (key === "provider.npi") {
    out.push(formatNpi(raw));
  }
  // Multi-line address: any single non-trivial line counts
  if (key.includes("address") || key.includes("Address")) {
    for (const line of raw.split(/\n|,/)) {
      const t = line.trim();
      if (t.length >= 5) out.push(t);
    }
  }
  return out.filter(Boolean);
}

export function canExportLetter(
  letterText: string,
  ledger: FactLedger
): { ok: boolean; errors: ValidationError[] } {
  const errors = validateLetter(letterText, ledger).filter(
    (e) => e.severity !== "warning"
  );
  return { ok: errors.length === 0, errors };
}
