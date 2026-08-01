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
import {
  LETTER_DISCLAIMER,
  ensureLetterDisclaimer,
} from "../letter/disclaimer";
import { stripInternalLanguageFromLetter } from "../letter/internalLanguage";
import { validateLetter, canExportLetter } from "../validate/index";
import { findUnapprovedCitations } from "../validate/citations";
import { cignaFullRequiredLedger } from "../__fixtures__/cigna";

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
    const lines = letter.trim().split("\n");
    assert.equal(lines[lines.length - 1], LETTER_DISCLAIMER);
  });

  it("approves ERISA procedural violation language without contract allegation error", () => {
    const L = cignaFullRequiredLedger();
    const body =
      "Under ERISA § 502(a)(1)(B) and 29 C.F.R. § 2560.503-1(i), this procedural violation warrants reversal.";
    const letter = ensureLetterDisclaimer(body);
    const errors = validateLetter(letter, L).filter(
      (e) => e.rule === "no_contract_breach_allegation"
    );
    assert.equal(errors.length, 0);
    assert.deepEqual(findUnapprovedCitations(body, L), []);
  });

  it("strips internal ledger vocabulary before validation", () => {
    const L = cignaFullRequiredLedger();
    const cleaned = stripInternalLanguageFromLetter(
      "The fact ledger shows medical necessity."
    );
    assert.ok(!/\bledger\b/i.test(cleaned));
    const errors = validateLetter(
      ensureLetterDisclaimer(`${cleaned}\n\nTo the Appeals Review Department:\n\nAppeal text.`),
      L
    ).filter((e) => e.rule === "no_internal_grounding_language");
    assert.equal(errors.length, 0);
  });

  it("ends assembled letters with the full disclaimer text", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["M54.5"] });
    const letter = assembleLetter(
      result.ledger,
      "We request reprocessing at the contracted rate.",
      getAuthoritiesForLedger(result.ledger)
    );
    assert.ok(letter.endsWith(LETTER_DISCLAIMER));
    assert.match(letter, /Generated letters are for administrative use only\.$/);
    const disclaimerCount = (
      letter.match(/Denial Appeal Pro is not a law firm/gi) || []
    ).length;
    assert.equal(disclaimerCount, 1);
    assert.ok(!letter.includes("© 2026 Denial Appeal Pro"));
    assert.ok(!/Build\s+\d+/i.test(letter));
  });

  it("deduplicates disclaimer when model body already includes one", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["M54.5"] });
    const letter = assembleLetter(
      result.ledger,
      `We request reprocessing.\n\n${LETTER_DISCLAIMER}\n\n© 2026 Denial Appeal Pro · Build 1 |`,
      getAuthoritiesForLedger(result.ledger)
    );
    assert.equal(
      (letter.match(/Denial Appeal Pro is not a law firm/gi) || []).length,
      1
    );
    assert.ok(letter.endsWith(LETTER_DISCLAIMER));
    assert.ok(!letter.includes("Build 1"));
  });

  it("resolves claim.deniedAmount placeholders in assembled letter", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["M54.5"] });
    const letter = assembleLetter(
      result.ledger,
      "Pay full payment of the denied amount from claim.deniedAmount.",
      getAuthoritiesForLedger(result.ledger)
    );
    assert.ok(!letter.includes("claim.deniedAmount"));
    assert.match(letter, /\$425\.00/);
  });

  it("full BCBS bundling assembler regression — four deploy fixes", () => {
    const result = runBcbsBundlingAcceptance({ icd10Codes: ["M54.5"] });
    const narrative =
      "We request reprocessing at the contracted rate. " +
      "Pay full payment of the denied amount from claim.deniedAmount.";
    const letter = assembleLetter(
      result.ledger,
      narrative,
      getAuthoritiesForLedger(result.ledger)
    );

    const disclaimerCount = (
      letter.match(/not a law firm/gi) || []
    ).length;
    assert.equal(
      disclaimerCount,
      1,
      `disclaimer must appear exactly once, found ${disclaimerCount}`
    );

    assert.ok(
      !letter.includes("claim.deniedAmount"),
      "letter must not contain unresolved claim.deniedAmount"
    );

    const modifier25Count = (letter.match(/modifier\s*25/gi) || []).length;
    assert.ok(
      modifier25Count <= 4,
      `modifier 25 must appear at most 4 times, found ${modifier25Count}`
    );

    assert.ok(!letter.includes("© 2026"), "letter must not contain copyright line");
    assert.ok(!/\bBuild\s+\d+/i.test(letter), "letter must not contain Build footer");

    const lines = letter.trimEnd().split("\n");
    assert.equal(
      lines[lines.length - 1],
      LETTER_DISCLAIMER,
      "letter must end with canonical disclaimer"
    );
    assert.ok(letter.endsWith(LETTER_DISCLAIMER));
  });
});
