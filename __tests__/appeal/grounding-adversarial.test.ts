/**
 * Phase 1.6 — adversarial grounding checks against gpt-4o (×3 each).
 * Run: npm run test:phase1:adversarial
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice } from "./_helpers/assertLlm";
import {
  buildLedgerFromExtraction,
  CLINICAL_KEYS,
  emptyLedger,
  generateAppealLetter,
  setFact,
  validateLetter,
} from "../../lib/appeal/netlify-entry";
import {
  cignaCodesOnlyLedger,
  CIGNA_RAW_DENIAL_TEXT,
  cignaExtractionFields,
} from "../../lib/appeal/__fixtures__/cigna";
import type { FactKey, FactLedger } from "../../lib/appeal/ledger/types";

const CLINICAL_NARRATIVE =
  /\b(osteoarthritis|emergent|urgent|unscheduled|conservative\s+(?:management|care)|functional\s+impairment|medically\s+necessary|failed\s+treatment|chronic\s+pain|degenerative|refractory|intraoperative|severity|duration|history\s+of)\b/i;

const ENCLOSURE_LANG =
  /\b(enclosed|herewith|attached|please\s+find|accompanying\s+documents?)\b/i;

function withRequiredOverlay(base: FactLedger): FactLedger {
  let ledger = base;
  const pairs: Array<[FactKey, string | string[]]> = [
    ["claim.payerAppealAddress", "P.O. Box 182223, Chattanooga, TN 37422"],
    ["claim.dateOfService", "2026-02-28"],
    ["patient.name", "James Whitfield"],
    ["patient.memberId", "CIG987654321"],
    ["provider.name", "Riverside Medical Group"],
    ["provider.npi", "1568890123"],
    ["provider.addressBlock", "400 River Walk, Suite 200, Chattanooga, TN 37402"],
    ["provider.phone", "423-555-0144"],
    ["signer.name", "Jordan Hale"],
    ["signer.title", "Appeals Coordinator"],
    ["patient.planType", "unknown"],
  ];
  for (const [k, v] of pairs) {
    if (!ledger.facts[k]) {
      ledger = setFact(ledger, k, v, "user", `wizard:step3:${k}`, 1);
    }
  }
  return ledger;
}

describe("adversarial grounding", () => {
  it("1. CPT 27130 + CO-15 only — no clinical narrative / urgency / procedure justification beyond code (LLM ×3)", async () => {
    const ledger = withRequiredOverlay(cignaCodesOnlyLedger());
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.equal(CLINICAL_NARRATIVE.test(result.text), false, result.text);
        assert.match(result.text, /27130/);
        assert.equal(/\bhip\s+replacement\b/i.test(result.text), false, result.text);
      }
    );
  });

  it('2. clinical field = "pain" only — letter does not expand severity/duration/treatment history (LLM ×3)', async () => {
    let ledger = withRequiredOverlay(cignaCodesOnlyLedger());
    ledger = setFact(
      ledger,
      "clinical.indication",
      "pain",
      "user",
      "wizard:step3:indication",
      1
    );
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(result.text, /\bpain\b/i);
        assert.equal(
          /\b(severe|moderate|mild|weeks|months|years|NSAID|physical therapy|failed)\b/i.test(
            result.text
          ),
          false,
          result.text
        );
      }
    );
  });

  it("3. All enclosures unchecked — no Enclosures: block and no enclosure language in body (LLM ×3)", async () => {
    let ledger = withRequiredOverlay(cignaCodesOnlyLedger());
    ledger = {
      ...ledger,
      enclosures: ledger.enclosures.map((e) => ({ ...e, checked: false })),
    };
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.equal(/Enclosures:/i.test(result.text), false, result.text);
        assert.equal(ENCLOSURE_LANG.test(result.text), false, result.text);
      }
    );
  });

  it("4. Stray ICD-10 in denial free text is NOT promoted into clinical.icd10Codes (LLM ×3)", async () => {
    const { ledger: extracted } = buildLedgerFromExtraction({
      fields: cignaExtractionFields(),
      rawText: CIGNA_RAW_DENIAL_TEXT,
      documentId: "cigna-with-icd.pdf",
    });
    assert.equal(extracted.facts["clinical.icd10Codes"], undefined);
    for (const key of CLINICAL_KEYS) {
      assert.equal(extracted.facts[key], undefined, key);
    }
    assert.throws(
      () =>
        setFact(
          emptyLedger(),
          "clinical.icd10Codes",
          ["M16.11"],
          "document",
          "doc:x:p1:icd"
        ),
      /Clinical fact/
    );

    const ledger = withRequiredOverlay(cignaCodesOnlyLedger());
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.equal(/\bM16\.11\b/.test(result.text), false, result.text);
        assert.equal(/\bosteoarthritis\b/i.test(result.text), false, result.text);
        assert.equal(
          validateLetter(result.text, ledger).filter(
            (e) => e.rule === "clinical_claims_grounded"
          ).length,
          0,
          result.text
        );
      }
    );
  });
});
