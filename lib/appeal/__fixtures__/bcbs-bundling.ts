import { emptyLedger, setFact } from "../ledger/builder";
import type { FactKey, FactLedger } from "../ledger/types";
import { applyIntakeToLedger } from "../ledger/intakeToLedger";
import { emptyIntake, type DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import { deterministicGroundedDraft } from "../generate/deterministicDraft";
import { validateLetter } from "../validate/index";
import { routeDenial } from "../router/index";
import { isCarc4M144Bundling } from "../router/bundling-detect";

export const BCBS_BUNDLING_RAW_TEXT = `
BLUE CROSS BLUE SHIELD
P.O. Box 990123
Detroit, MI 48290

Member: Robert Tatum
Member ID: XYZ123456789
Claim Number: BCBS-2026-445821
Provider: Riverside Medical Group
Date of Service: 01/15/2026
Date Processed: 01/28/2026

CPT/HCPCS: 99213, 93000
CARC: CO-4
RARC: M144

Billed: $525.00
Allowed: $100.00
Paid: $100.00
Denied: $425.00

Remark: If modifier 25 applies and the E/M service was significant and separately identifiable, resubmit with modifier 25 appended to CPT 99213.
`.trim();

function apply(
  ledger: FactLedger,
  entries: Array<[FactKey, string | string[]]>,
  provenance: "document" | "user"
): FactLedger {
  let L = ledger;
  for (const [key, value] of entries) {
    L = setFact(
      L,
      key,
      value,
      provenance,
      provenance === "document" ? `doc:bcbs:p1:${key}` : `wizard:step3:${key}`,
      provenance === "document" ? 0.9 : 1
    );
  }
  return L;
}

export function buildBcbsBundlingLedger(opts?: {
  icd10Codes?: string[];
}): FactLedger {
  const icd = opts?.icd10Codes ?? [];

  let L = emptyLedger(["bcbs-bundling"]);
  L = apply(
    L,
    [
      ["claim.number", "BCBS-2026-445821"],
      ["claim.payerName", "Blue Cross Blue Shield"],
      ["claim.payerAppealAddress", "P.O. Box 990123, Detroit, MI 48290"],
      ["claim.dateOfService", "2026-01-15"],
      ["claim.billedAmount", "525.00"],
      ["claim.paidAmount", "100.00"],
      ["claim.deniedAmount", "425.00"],
      ["claim.carcCodes", ["4"]],
      ["claim.rarcCodes", ["M144"]],
      ["claim.cptCodes", ["99213", "93000"]],
      ["patient.name", "Robert Tatum"],
      ["patient.memberId", "XYZ123456789"],
      ["patient.planType", "fully-insured-group"],
      ["provider.name", "Riverside Medical Group"],
      ["provider.npi", "1568890123"],
      [
        "provider.addressBlock",
        "400 River Walk, Suite 200, Chattanooga, TN 37402",
      ],
      ["provider.phone", "423-555-0144"],
      ["signer.name", "Jordan Hale"],
      ["signer.title", "Appeals Coordinator"],
    ],
    "user"
  );

  if (icd.length) {
    L = apply(L, [["claim.icd10Codes", icd]], "user");
  }

  const intake: DenialIntake = {
    ...emptyIntake(),
    patientName: "Robert Tatum",
    memberId: "XYZ123456789",
    payer: "Blue Cross Blue Shield",
    claimNumber: "BCBS-2026-445821",
    dateOfService: "2026-01-15",
    providerName: "Riverside Medical Group",
    providerNpi: "1568890123",
    providerAddress: "400 River Walk, Suite 200, Chattanooga, TN 37402",
    providerPhone: "423-555-0144",
    carcCodes: ["4"],
    rarcCodes: ["M144"],
    cptCodes: ["99213", "93000"],
    billedAmount: "525.00",
    paidAmount: "100.00",
    deniedAmount: "425.00",
    planType: "fully-insured-group",
    bundlingBranch: "modifier-25",
    icdCodes: icd,
    signerName: "Jordan Hale",
    signerTitle: "Appeals Coordinator",
  };

  return applyIntakeToLedger(L, intake);
}

export function runBcbsBundlingAcceptance(opts?: { icd10Codes?: string[] }) {
  const ledger = buildBcbsBundlingLedger(opts);
  const route = routeDenial(ledger);
  const draft = deterministicGroundedDraft(ledger);
  const errors = validateLetter(draft.text, ledger);
  const text = draft.text;

  return {
    ledger,
    route,
    text,
    errors,
    checks: {
      providerCorrect: text.includes("Riverside Medical Group"),
      payerCorrect: text.includes("Blue Cross Blue Shield"),
      providerNotPayer:
        !/^Riverside Medical Group/m.test(text) ||
        !text.match(/Provider[^\n]*Cigna/i),
      carc4M144: isCarc4M144Bundling(ledger),
      bundlingStrategy: route.strategy.id === "bundling",
      modifier25Arg: /modifier\s*25/i.test(text),
      ncciArg: /NCCI/i.test(text),
      noPlaceholder: !/\[\[REQUIRED:/.test(text),
      noUnknownDenial: !/Unknown denial reason/i.test(text),
      exportPass: errors.length === 0,
      descriptor: route.primaryCarc?.descriptor ?? "",
    },
  };
}
