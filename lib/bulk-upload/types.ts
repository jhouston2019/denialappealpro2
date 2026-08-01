import type { FactLedger } from "@/lib/appeal/ledger/types";
import type { DapConfidenceMap } from "@/lib/dap-wizard-snapshot";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

export const MAX_BULK_FILES = 10;

export type BulkExtractStatus = "pending" | "extracting" | "ready" | "failed";

export type BulkGenerateStatus =
  | "not_started"
  | "generating"
  | "generated"
  | "generate_failed";

export type BulkUploadItem = {
  id: string;
  file: File;
  extractStatus: BulkExtractStatus;
  generateStatus: BulkGenerateStatus;
  error?: string;
  generateError?: string;
  intake?: DenialIntake;
  confidence?: DapConfidenceMap;
  ledger?: FactLedger | null;
  reviewId?: string;
};

export type BulkProviderDefaults = Pick<
  DenialIntake,
  | "providerName"
  | "providerNpi"
  | "providerAddress"
  | "providerPhone"
  | "providerFax"
  | "signerName"
  | "signerTitle"
  | "signerCredentials"
  | "signerPhone"
>;
