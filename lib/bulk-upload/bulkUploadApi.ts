import type { FactLedger } from "@/lib/appeal/ledger/types";
import { ensureLedgerWithStrategyBranches } from "@/lib/appeal/router/resolveStrategyBranches";
import { DEFAULT_ENCLOSURES } from "@/lib/appeal/ledger/keys";
import type { EnclosureItem } from "@/lib/appeal/ledger/types";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import {
  mapExtractedToIntake,
  type ExtractDenialResponse,
} from "@/lib/wizard/mapExtractedToIntake";
import { wizardFetch } from "@/lib/supabaseClient";
import type { BulkProviderDefaults } from "./types";

function defaultEnclosures(): EnclosureItem[] {
  return DEFAULT_ENCLOSURES.map((e) => ({
    id: e.id,
    label: e.label,
    checked: false,
  }));
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function extractBulkPdf(
  file: File
): Promise<ExtractDenialResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/extract-denial", {
    method: "POST",
    body: formData,
  });
  const payload = (await res.json()) as ExtractDenialResponse;
  if (!res.ok || !payload.success) {
    throw new Error(
      payload.error?.trim() ||
        payload.message?.trim() ||
        "Could not extract denial data from this PDF."
    );
  }
  return payload;
}

export function mergeBulkIntake(
  payload: ExtractDenialResponse,
  providerDefaults: BulkProviderDefaults
): {
  intake: DenialIntake;
  confidence: ReturnType<typeof mapExtractedToIntake>["confidence"];
  ledger: ReturnType<typeof mapExtractedToIntake>["ledger"];
} {
  const mapped = mapExtractedToIntake(payload);
  const intake: DenialIntake = {
    ...mapped.intake,
    providerName: mapped.intake.providerName || providerDefaults.providerName,
    providerNpi: mapped.intake.providerNpi || providerDefaults.providerNpi,
    providerAddress:
      mapped.intake.providerAddress || providerDefaults.providerAddress,
    providerPhone:
      mapped.intake.providerPhone || providerDefaults.providerPhone,
    providerFax: mapped.intake.providerFax || providerDefaults.providerFax,
    signerName: mapped.intake.signerName || providerDefaults.signerName,
    signerTitle: mapped.intake.signerTitle || providerDefaults.signerTitle,
    signerCredentials:
      mapped.intake.signerCredentials ||
      providerDefaults.signerCredentials,
    signerPhone: mapped.intake.signerPhone || providerDefaults.signerPhone,
    planType: mapped.intake.planType ?? "fully-insured-group",
  };
  return {
    intake,
    confidence: mapped.confidence,
    ledger: mapped.ledger,
  };
}

export async function generateBulkAppeal(
  intake: DenialIntake,
  ledger: FactLedger | null | undefined
): Promise<{ reviewId: string; validationErrors?: Array<{ rule: string; message: string }> }> {
  const enclosures = defaultEnclosures();
  const factLedger = ensureLedgerWithStrategyBranches(
    ledger,
    intake,
    enclosures
  );

  const body = {
    ledger: factLedger,
    patientName: intake.patientName,
    providerName: intake.providerName,
    providerNpi: intake.providerNpi,
    payerName: intake.payer,
    claimNumber: intake.claimNumber,
    dateOfService: intake.dateOfService,
    denialReason: intake.denialReason,
    carcCodes: intake.carcCodes,
    rarcCodes: intake.rarcCodes,
    billedAmount: intake.billedAmount,
    paidAmount: intake.paidAmount,
    deniedAmount: intake.deniedAmount,
    icd10Codes: intake.icdCodes,
    cptCodes: intake.cptCodes,
    additionalContext: intake.additionalContext,
    providerAddress: intake.providerAddress,
    providerPhone: intake.providerPhone,
    providerFax: intake.providerFax,
    memberId: intake.memberId,
    signerName: intake.signerName,
    signerTitle: intake.signerTitle,
  };

  const res = await wizardFetch(netlifyFunctionUrl("generate-appeal"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    success?: boolean;
    reviewId?: string;
    validationErrors?: Array<{ rule: string; message: string }>;
    error?: string;
  };

  if (!res.ok || !data.success || !data.reviewId) {
    throw new Error(data.error?.trim() || "Appeal generation failed.");
  }

  return {
    reviewId: data.reviewId,
    validationErrors: data.validationErrors,
  };
}

export function formatCodeList(codes: string[] | undefined): string {
  if (!codes?.length) return "—";
  return codes.join(", ");
}
