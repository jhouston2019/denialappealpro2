import { getValue } from "@/lib/appeal/ledger/builder";
import type { FactLedger } from "@/lib/appeal/ledger/types";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

export type RecentAppealRow = {
  id: string;
  insured_name: string | null;
  created_at: string;
  ai_summary_json: unknown;
  letter_text: string | null;
};

export type RecentAppealSummary = {
  id: string;
  patientName: string;
  payer: string;
  carcCodes: string[];
  createdAt: string;
  statusLabel: string;
  statusTone: "ready" | "warning" | "neutral";
  providerPatch: Partial<DenialIntake>;
};

type DapSummaryJson = {
  status?: string;
  exportAllowed?: boolean;
  validationErrors?: unknown[];
  intake?: Record<string, unknown> & {
    ledger?: FactLedger;
    payerName?: string;
    carcCodes?: string[];
  };
  ledger?: FactLedger;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function ledgerString(ledger: FactLedger | null | undefined, key: Parameters<typeof getValue>[1]): string {
  if (!ledger) return "";
  const v = getValue(ledger, key);
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v).trim();
}

function ledgerArray(ledger: FactLedger | null | undefined, key: Parameters<typeof getValue>[1]): string[] {
  if (!ledger) return [];
  const v = getValue(ledger, key);
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v).trim();
  return s ? [s] : [];
}

export function providerPatchFromReview(row: RecentAppealRow): Partial<DenialIntake> {
  const summary = (row.ai_summary_json ?? {}) as DapSummaryJson;
  const intake = summary.intake ?? {};
  const ledger = summary.ledger ?? intake.ledger ?? null;

  return {
    providerName:
      str(intake.providerName) || ledgerString(ledger, "provider.name"),
    providerNpi: str(intake.providerNpi) || ledgerString(ledger, "provider.npi"),
    providerAddress:
      str(intake.providerAddress) ||
      ledgerString(ledger, "provider.addressBlock"),
    providerPhone:
      str(intake.providerPhone) || ledgerString(ledger, "provider.phone"),
    providerFax: str(intake.providerFax) || ledgerString(ledger, "provider.fax"),
    signerName:
      str(intake.signerName) ||
      ledgerString(ledger, "signer.name") ||
      ledgerString(ledger, "provider.name"),
    signerTitle:
      str(intake.signerTitle) || ledgerString(ledger, "signer.title"),
    signerCredentials:
      str(intake.signerCredentials) ||
      ledgerString(ledger, "signer.credentials"),
    signerPhone:
      str(intake.signerPhone) ||
      ledgerString(ledger, "signer.phone") ||
      ledgerString(ledger, "provider.phone"),
  };
}

export function parseRecentAppealRow(row: RecentAppealRow): RecentAppealSummary {
  const summary = (row.ai_summary_json ?? {}) as DapSummaryJson;
  const intake = summary.intake ?? {};
  const ledger = summary.ledger ?? intake.ledger ?? null;

  const patientName =
    row.insured_name?.trim() ||
    str(intake.patientName) ||
    ledgerString(ledger, "patient.name") ||
    "Denial Appeal";

  const payer =
    str(intake.payerName) ||
    str(intake.payer) ||
    ledgerString(ledger, "claim.payerName") ||
    "—";

  const carcCodes =
    arr(intake.carcCodes).length > 0
      ? arr(intake.carcCodes)
      : ledgerArray(ledger, "claim.carcCodes");

  let statusLabel = "Ready";
  let statusTone: RecentAppealSummary["statusTone"] = "ready";

  if (summary.status && summary.status !== "completed") {
    statusLabel = summary.status.replace(/_/g, " ");
    statusTone = "neutral";
  } else if (summary.exportAllowed === false || (summary.validationErrors?.length ?? 0) > 0) {
    statusLabel = "Needs review";
    statusTone = "warning";
  } else if (!row.letter_text?.trim()) {
    statusLabel = "In progress";
    statusTone = "neutral";
  }

  return {
    id: row.id,
    patientName,
    payer,
    carcCodes,
    createdAt: row.created_at,
    statusLabel,
    statusTone,
    providerPatch: providerPatchFromReview(row),
  };
}

export function formatRecentAppealDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCarcList(codes: string[]): string {
  if (!codes.length) return "—";
  return codes
    .slice(0, 3)
    .map((code) => {
      const trimmed = code.trim();
      if (!trimmed) return "";
      if (/^CO-/i.test(trimmed)) return trimmed.toUpperCase();
      const digits = trimmed.replace(/^CO-?/i, "");
      return digits ? `CO-${digits}` : trimmed;
    })
    .filter(Boolean)
    .join(", ");
}

type ValidationErrorLike = {
  rule?: string;
  message?: string;
};

function pushUnique(list: string[], label: string) {
  if (!list.includes(label)) list.push(label);
}

/** Human-readable export gaps for dashboard "Needs Review" rows. */
export function reviewValidationGaps(row: RecentAppealRow): string[] {
  const summary = (row.ai_summary_json ?? {}) as DapSummaryJson;
  const gaps: string[] = [];
  const errors = (summary.validationErrors ?? []) as ValidationErrorLike[];

  for (const err of errors) {
    const rule = String(err?.rule ?? "").toLowerCase();
    const message = String(err?.message ?? "").toLowerCase();

    if (
      rule.includes("icd") ||
      rule.includes("diagnosis") ||
      message.includes("icd-10") ||
      message.includes("diagnosis")
    ) {
      pushUnique(gaps, "Missing ICD-10");
    }
    if (rule.includes("npi") || message.includes("npi")) {
      pushUnique(gaps, "Missing provider NPI");
    }
    if (
      rule.includes("placeholder") ||
      message.includes("placeholder") ||
      message.includes("[[required:")
    ) {
      pushUnique(gaps, "Unresolved placeholder");
    }
    if (rule.includes("citation") || message.includes("citation")) {
      pushUnique(gaps, "Citation validation failure");
    }
  }

  const letter = row.letter_text ?? "";
  if (/XXX\.XXX/i.test(letter)) {
    pushUnique(gaps, "Missing ICD-10");
  }
  if (/\[\[REQUIRED:/i.test(letter)) {
    pushUnique(gaps, "Unresolved placeholder");
  }

  if (
    gaps.length === 0 &&
    (summary.exportAllowed === false || errors.length > 0)
  ) {
    if (errors[0]?.message?.trim()) {
      pushUnique(gaps, errors[0].message.trim());
    } else {
      pushUnique(gaps, "Export blocked — resolve missing facts");
    }
  }

  return gaps;
}

export type ReviewStatusFilter =
  | "all"
  | "ready"
  | "needs_review"
  | "in_progress";

export function reviewStatusBucket(
  summary: RecentAppealSummary
): Exclude<ReviewStatusFilter, "all"> {
  const label = summary.statusLabel.toLowerCase();
  if (label === "ready") return "ready";
  if (label.includes("needs review")) return "needs_review";
  if (label.includes("progress")) return "in_progress";
  return "in_progress";
}
