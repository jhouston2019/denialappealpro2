import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BCBS_BUNDLING_CLAIM_NUMBER,
  runBcbsBundlingAcceptance,
} from "../__fixtures__/bcbs-bundling";
import { renderAuthorityRecord } from "../authorities/renderRecord";
import { getRecordById } from "../authorities/records";
import { getAuthoritiesForLedger } from "../authorities/gate";
import { stripIcd10PlaceholdersFromText } from "../format/normalizeIcd10";
import { assembleLetter } from "../letter/assembler";

describe("letter generation bug fixes — BCBS bundling", () => {
  it("omits XXX.XXX placeholder ICD-10 from header and body", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["XXX.XXX"] });
    assert.ok(result.checks.noPlaceholderIcd);
    assert.ok(!result.text.includes("ICD-10:"));
    assert.match(
      stripIcd10PlaceholdersFromText(
        "Claim summary with ICD-10: XXX.XXX and diagnosis XXX.XXX."
      ),
      /Claim summary with and diagnosis \./
    );
  });

  it("uses single NCCI citation and no modifier 59 block for modifier-25 branch", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["M54.5"] });
    assert.ok(result.checks.singleNcciCitation, result.text);
    assert.ok(result.checks.noModifier59Citation, result.text);
    assert.ok(
      !result.authorities.some((r) => r.id === "cpt-guidelines-separate-procedure")
    );
    assert.ok(
      result.authorities.some((r) => r.id === "cms-ncci-modifier-25")
    );
  });

  it("renders ERISA authority with BCBS claim and CO-4/M144 — not Cigna test data", () => {
    const result = runBcbsBundlingAcceptance({
      icd10Codes: ["M54.5"],
      planType: "erisa-self-funded",
    });
    const erisa = getRecordById("erisa-503-full-fair-review");
    assert.ok(erisa);
    const rendered = renderAuthorityRecord(erisa!, result.ledger);
    assert.match(rendered.argument, new RegExp(BCBS_BUNDLING_CLAIM_NUMBER));
    assert.match(rendered.argument, /CO-4/);
    assert.match(rendered.argument, /M144/);
    assert.ok(!rendered.argument.includes("CIG-2026-887731"));
    assert.ok(!rendered.argument.includes("CO-15"));
    assert.ok(!rendered.argument.includes("N517"));

    const letter = assembleLetter(
      result.ledger,
      "We request reprocessing at the contracted rate.",
      getAuthoritiesForLedger(result.ledger)
    );
    assert.ok(result.checks.erisaUsesClaim, letter);
    assert.ok(result.checks.erisaUsesBundlingCodes, letter);
    assert.ok(result.checks.noCignaClaimLeak, letter);
  });
});
