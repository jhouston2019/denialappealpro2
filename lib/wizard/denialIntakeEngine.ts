/**
 * CARC/RARC mapping, denial category detection, and appeal strategy hints.
 * Aligned conceptually with backend/denial_rules.py
 */

const STRATEGY_LABELS: Record<string, string> = {
  medical_necessity: "Medical necessity rebuttal",
  timely_filing: "Timely filing / good-cause argument",
  prior_authorization: "Prior authorization / precertification path",
  duplicate_claim: "Duplicate claim differentiation",
  coordination_benefits: "Coordination of benefits resolution",
  non_covered: "Coverage & medical necessity review",
  benefit_maximum: "Benefit limit / bundling review",
  coding_error: "Modifier & coding correction",
  not_covered_patient: "Eligibility & coverage verification",
  precertification: "Retroactive authorization request",
  experimental: "Medical necessity & standard-of-care evidence",
  coverage_inactive: "Eligibility period verification",
  out_of_network: "Network / OON benefit argument",
  date_error: "Date of service correction",
  diagnosis_error: "Diagnosis / coding alignment",
  patient_info_error: "Demographic / member info correction",
  additional_documentation: "Documentation gap closure",
  general: "Comprehensive denial appeal",
};

/** Primary CARC digits -> category title + short explanation */
const CARC_CATALOG: Record<
  number,
  { category: string; explanation: string; strategy: string }
> = {
  50: {
    category: "Medical necessity",
    explanation:
      "Payer states the service was not medically necessary under plan rules.",
    strategy: "medical_necessity",
  },
  96: {
    category: "Non-covered charge",
    explanation:
      "Service or item is classified as non-covered under the benefit plan.",
    strategy: "non_covered",
  },
  97: {
    category: "Bundling / benefit maximum",
    explanation:
      "Payment included in another allowance or benefit limit applies.",
    strategy: "benefit_maximum",
  },
  16: {
    category: "Claim / submission error",
    explanation:
      "Missing information, billing error, or authorization issue cited.",
    strategy: "prior_authorization",
  },
  197: {
    category: "Precertification / authorization",
    explanation: "Required authorization or notification was absent.",
    strategy: "precertification",
  },
  29: {
    category: "Timely filing",
    explanation: "Claim filed outside the payer's timely filing limit.",
    strategy: "timely_filing",
  },
  4: {
    category: "Coding / modifier",
    explanation:
      "Procedure inconsistent with modifier or required modifier missing.",
    strategy: "coding_error",
  },
  22: {
    category: "Coordination of benefits",
    explanation: "Another payer may be primary; COB applies.",
    strategy: "coordination_benefits",
  },
  18: {
    category: "Duplicate claim",
    explanation: "Payer identifies duplicate or overlapping claim lines.",
    strategy: "duplicate_claim",
  },
  252: {
    category: "Additional documentation",
    explanation:
      "Further records or attachments are required to process the claim.",
    strategy: "additional_documentation",
  },
};

/** Common RARC prefixes → supplemental strategy */
const RARC_STRATEGY_HINTS = [
  { test: /^M15/i, strategy: "coding_error", label: "Modifier / code edit (e.g. CCI)" },
  { test: /^N1/i, strategy: "additional_documentation", label: "Documentation / contract issue" },
  { test: /^N56/i, strategy: "prior_authorization", label: "Authorization / referral" },
  { test: /^N115/i, strategy: "medical_necessity", label: "Medical necessity / LCD" },
];

export function normalizeCarcToken(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toUpperCase();
  const m = s.match(/(?:CO|PR|OA|CARC)?[-\s]?(\d{1,3})/);
  if (m) return m[1].replace(/^0+/, "") || m[1];
  const digits = s.replace(/\D/g, "");
  return digits.length ? String(parseInt(digits, 10)) : null;
}

export function normalizeRarcToken(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  return String(raw).trim().toUpperCase();
}

function lookupCarc(num: string) {
  const n = parseInt(num, 10);
  return CARC_CATALOG[n] || null;
}

/**
 * Auto-map CARC/RARC to a denial category + explanation for display.
 */
export function getDenialCategoryFromCodes(
  carcCodes: string[] | undefined,
  rarcCodes: string[] | undefined
) {
  const carc = (carcCodes || []).map(normalizeCarcToken).filter(Boolean) as string[];
  const rarc = (rarcCodes || []).map(normalizeRarcToken).filter(Boolean) as string[];

  let category = "General denial";
  let explanation =
    "Review payer notice and supporting contract language for this claim.";

  if (carc.length) {
    const first = lookupCarc(carc[0]);
    if (first) {
      category = first.category;
      explanation = first.explanation;
    } else {
      category = `CARC ${carc[0]} — payer-specific denial`;
      explanation =
        "Use clinical and policy documentation to rebut this adjustment category.";
    }
  } else if (rarc.length) {
    category = `Remittance ${rarc[0]}`;
    explanation =
      "RARC indicates a specific remittance reason; align appeal to remark code guidance.";
  }

  return { category, explanation, primaryCarc: carc[0] || null, primaryRarc: rarc[0] || null };
}

function strategyKeyToLabel(key: string) {
  return STRATEGY_LABELS[key] || STRATEGY_LABELS.general;
}

/**
 * Returns up to 3 concrete appeal strategy lines from CARC + RARC inputs.
 */
export function mapDenialToStrategy(
  carcCodes: string[] | undefined,
  rarcCodes: string[] | undefined
) {
  const out: string[] = [];
  const seen = new Set<string>();

  const carc = (carcCodes || []).map(normalizeCarcToken).filter(Boolean) as string[];
  const rarc = (rarcCodes || []).map(normalizeRarcToken).filter(Boolean) as string[];

  for (const c of carc) {
    const row = lookupCarc(c);
    if (row?.strategy && !seen.has(row.strategy)) {
      seen.add(row.strategy);
      out.push(strategyKeyToLabel(row.strategy));
    }
    if (out.length >= 3) return out;
  }

  for (const code of rarc) {
    for (const hint of RARC_STRATEGY_HINTS) {
      if (hint.test.test(code) && !seen.has(hint.strategy)) {
        seen.add(hint.strategy);
        out.push(hint.label);
      }
    }
    if (out.length >= 3) return out;
  }

  if (!out.length) {
    out.push(
      "Medical necessity rebuttal",
      "Documentation gap",
      "Policy & contract review"
    );
  }
  while (out.length < 3) {
    const fill = [
      "Clinical documentation strengthening",
      "Peer-to-peer escalation",
      "External review readiness",
    ];
    const next = fill.find((f) => !out.includes(f));
    if (next) out.push(next);
    else break;
  }
  return out.slice(0, 3);
}

export type DenialIntake = {
  claimNumber: string;
  dateOfService: string;
  payer: string;
  patientName: string;
  providerName: string;
  providerNpi: string;
  providerAddress: string;
  providerPhone: string;
  providerFax: string;
  planType: string;
  carcCodes: string[];
  rarcCodes: string[];
  cptCodes: string[];
  modifiers: string;
  icdCodes: string[];
  billedAmount: string;
  paidAmount: string;
  treatmentProvided: string;
  medicalNecessity: string;
  specialCircumstances: string;
  denialReason: string;
  additionalContext: string;
};

export function emptyIntake(): DenialIntake {
  return {
    claimNumber: "",
    dateOfService: "",
    payer: "",
    patientName: "",
    providerName: "",
    providerNpi: "",
    providerAddress: "",
    providerPhone: "",
    providerFax: "",
    planType: "Commercial",
    carcCodes: [],
    rarcCodes: [],
    cptCodes: [],
    modifiers: "",
    icdCodes: [],
    billedAmount: "",
    paidAmount: "",
    treatmentProvided: "",
    medicalNecessity: "",
    specialCircumstances: "",
    denialReason: "",
    additionalContext: "",
  };
}

export const PAYER_SUGGESTIONS = [
  "UnitedHealthcare",
  "Aetna",
  "Anthem / Elevance",
  "Cigna",
  "Humana",
  "Blue Cross Blue Shield",
  "Medicare",
  "Medicaid",
  "Tricare",
  "Kaiser Permanente",
  "Optum",
];

/**
 * ICD lists from extraction may use icd10_codes (canonical) and/or icd_codes (legacy).
 */
export function normalizeIcdCodesFromExtract(data: Record<string, unknown>) {
  if (!data || typeof data !== "object") return [];
  const buckets: string[] = [];
  for (const key of ["icd10_codes", "icd_codes", "icd10Codes", "icdCodes"]) {
    const v = data[key];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        const s = String(x).trim();
        if (s) buckets.push(s);
      }
    } else if (typeof v === "string" && v.trim()) {
      for (const p of v.split(/[,;\s]+/)) {
        const s = p.trim();
        if (s) buckets.push(s);
      }
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of buckets) {
    const u = p.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Build denial_reason narrative + supporting paste block for AI / backend.
 */
export function serializeIntakeForBackend(intake: DenialIntake) {
  const carc = (intake.carcCodes || []).join(", ");
  const rarc = (intake.rarcCodes || []).join(", ");
  const cpt = (intake.cptCodes || []).join(", ");
  const icd = (intake.icdCodes || []).join(", ");
  const { category, explanation } = getDenialCategoryFromCodes(
    intake.carcCodes,
    intake.rarcCodes
  );

  const billed = parseFloat(intake.billedAmount) || 0;
  const paid = parseFloat(intake.paidAmount) || 0;
  const recovery = Math.max(0, billed - paid);

  const denial_reason = [
    `DENIAL TYPE: ${category}`,
    `Summary: ${explanation}`,
    "",
    `CARC code(s): ${carc || "(none)"}`,
    `RARC code(s): ${rarc || "(none)"}`,
    `Plan type: ${intake.planType || "Commercial"}`,
    "",
    `CPT/HCPCS: ${cpt || "N/A"}${intake.modifiers ? ` (modifiers: ${intake.modifiers})` : ""}`,
    `ICD-10: ${icd || "N/A"}`,
    "",
    `Financials — Billed: $${billed.toFixed(2)} | Paid: $${paid.toFixed(2)} | Estimated recovery opportunity: $${recovery.toFixed(2)}`,
    "",
    "Clinical snapshot:",
    `- Treatment / service: ${intake.treatmentProvided || "See records"}`,
    `- Medical necessity: ${intake.medicalNecessity || "To be documented in records"}`,
    intake.specialCircumstances
      ? `- Special circumstances: ${intake.specialCircumstances}`
      : null,
    intake.denialReason ? `- Payer denial text: ${intake.denialReason}` : null,
    intake.additionalContext
      ? `- Additional context: ${intake.additionalContext}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const primaryCarc = intake.carcCodes?.[0];
  const denial_code = primaryCarc
    ? `CO-${primaryCarc}`
    : String(intake.rarcCodes?.[0] || "ADJ").slice(0, 50);

  const cptJoined = (intake.cptCodes || []).join(", ");
  const cptWithMods = [cptJoined, intake.modifiers].filter(Boolean).join(" ").trim();

  const paste_details = [
    intake.specialCircumstances
      ? `Special circumstances: ${intake.specialCircumstances}`
      : "",
    intake.additionalContext ? `Additional context: ${intake.additionalContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const icdPayload = icd.slice(0, 200);

  return {
    denial_reason,
    paste_details,
    denial_code: String(denial_code).slice(0, 50),
    cpt_codes: cptWithMods.slice(0, 200),
    diagnosis_code: icdPayload,
    icd10_codes: icdPayload,
    cpt_icd: [cptJoined, icd].filter(Boolean).join(", "),
  };
}
