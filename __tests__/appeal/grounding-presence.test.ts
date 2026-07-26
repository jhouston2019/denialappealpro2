/**
 * Phase 1.6 Part B — presence tests (clinical.* must reach the letter).
 * Each case ×3 against gpt-4o. Fail closed without OPENAI_API_KEY.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice, generateLlmWithRetry } from "./_helpers/assertLlm";
import {
  generateAppealLetter,
  setFact,
} from "../../lib/appeal/netlify-entry";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../../lib/appeal/__fixtures__/cigna";
import type { FactKey, FactLedger } from "../../lib/appeal/ledger/types";

/** Clinical terms that must NOT appear unless supplied in the ledger for the case. */
const EXTRA_CLINICAL =
  /\b(osteoarthritis|M16\.11|physical therapy|\bPT\b|corticosteroid|NSAID|ambulate|50 feet|degenerative joint|assistive device|refractory)\b/i;

function withClinical(
  pairs: Array<[FactKey, string]>
): FactLedger {
  let L = cignaFullRequiredLedger();
  for (const [k, v] of pairs) {
    L = setFact(L, k, v, "user", `wizard:step3:${k}`, 1);
  }
  return L;
}

function assertNoExtraClinical(letter: string, allowed: RegExp[]): void {
  // Strip allowed substrings, then ensure no leftover clinical fabrications.
  let scrubbed = letter;
  for (const re of allowed) {
    scrubbed = scrubbed.replace(re, " ");
  }
  assert.equal(
    EXTRA_CLINICAL.test(scrubbed),
    false,
    `Unexpected clinical content beyond supplied facts:\n${letter}\n--- scrubbed ---\n${scrubbed}`
  );
}

describe("grounding presence — clinical facts must appear in letter", () => {
  it("1. primaryDiagnosis reaches letter (LLM ×3)", async () => {
    const diagnosis = "Primary osteoarthritis of right hip, M16.11";
    const ledger = withClinical([["clinical.primaryDiagnosis", diagnosis]]);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        const hasDx =
          /Primary osteoarthritis of right hip/i.test(t) || /\bM16\.11\b/.test(t);
        assert.ok(hasDx, `diagnosis missing from letter:\n${t}`);
        assertNoExtraClinical(t, [
          /Primary osteoarthritis of right hip,? M16\.11/gi,
          /Primary osteoarthritis of right hip/gi,
          /M16\.11/gi,
          /osteoarthritis/gi,
        ]);
      }
    );
  });

  it("2. conservativeCareTried — PT, injection, NSAIDs all appear (LLM ×3)", async () => {
    const care =
      "Six months PT, intra-articular corticosteroid injection, NSAIDs";
    const ledger = withClinical([["clinical.conservativeCareTried", care]]);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        assert.ok(/\bPT\b|physical therapy/i.test(t), `PT missing:\n${t}`);
        assert.ok(
          /injection|corticosteroid/i.test(t),
          `injection missing:\n${t}`
        );
        assert.ok(/NSAID/i.test(t), `NSAIDs missing:\n${t}`);
        assertNoExtraClinical(t, [
          /Six months PT,? intra-articular corticosteroid injection,? NSAIDs/gi,
          /Six months PT/gi,
          /\bPT\b/g,
          /physical therapy/gi,
          /intra-articular corticosteroid injection/gi,
          /corticosteroid/gi,
          /injection/gi,
          /NSAIDs?/gi,
        ]);
      }
    );
  });

  it("3. functionalImpact — ambulation limitation appears (LLM ×3)", async () => {
    const impact =
      "Unable to ambulate more than 50 feet without assistive device";
    const ledger = withClinical([["clinical.functionalImpact", impact]]);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        assert.ok(
          /ambulat/i.test(t) && (/50\s*feet/i.test(t) || /assistive device/i.test(t)),
          `ambulation limitation missing:\n${t}`
        );
        assertNoExtraClinical(t, [
          /Unable to ambulate more than 50 feet without assistive device/gi,
          /ambulate/gi,
          /50 feet/gi,
          /assistive device/gi,
        ]);
      }
    );
  });

  it("4. indication + priorTreatments both appear (LLM ×3)", async () => {
    const indication =
      "End-stage degenerative joint disease of the right hip with refractory pain";
    const prior =
      "Activity modification, assistive device trial, and supervised physical therapy";
    const ledger = withClinical([
      ["clinical.indication", indication],
      ["clinical.priorTreatments", prior],
    ]);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        assert.ok(
          /degenerative joint|End-stage|refractory/i.test(t),
          `indication missing:\n${t}`
        );
        assert.ok(
          /Activity modification|assistive device trial|supervised physical therapy/i.test(
            t
          ),
          `priorTreatments missing:\n${t}`
        );
        assertNoExtraClinical(t, [
          new RegExp(indication.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
          new RegExp(prior.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
          /degenerative joint/gi,
          /End-stage/gi,
          /refractory/gi,
          /Activity modification/gi,
          /assistive device/gi,
          /physical therapy/gi,
        ]);
      }
    );
  });

  it("5. All five clinical fields appear; letter longer than empty-clinical (LLM ×3)", async () => {
    let emptyClinical = cignaFullRequiredLedger();
    let full = cignaFullRequiredLedger();
    for (const [k, v] of CLINICAL_ALL) {
      full = setFact(full, k, v as string, "user", `wizard:step3:${k}`, 1);
    }

    // Baseline length from one empty-clinical LLM letter
    const emptyResult = await generateLlmWithRetry(() =>
      generateAppealLetter(emptyClinical, {
        allowDeterministicFallback: false,
        model: "gpt-4o",
      })
    );
    const { assertLlmPath } = await import("./_helpers/assertLlm");
    assertLlmPath(emptyResult);
    console.log(`# generatorPath: '${emptyResult.generatorPath}' (empty baseline)`);
    const emptyLen = emptyResult.text.length;

    await assertLlmThrice(
      () =>
        generateAppealLetter(full, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        const checks: Array<[string, RegExp]> = [
          ["primaryDiagnosis", /osteoarthritis|M16\.11/i],
          ["conservativeCareTried", /\bPT\b|injection|NSAID/i],
          ["functionalImpact", /ambulat|50\s*feet/i],
          ["indication", /degenerative joint|refractory/i],
          ["priorTreatments", /Activity modification|physical therapy/i],
        ];
        const dropped: string[] = [];
        for (const [name, re] of checks) {
          if (!re.test(t)) dropped.push(name);
        }
        assert.equal(
          dropped.length,
          0,
          `Clinical fields dropped from letter: ${dropped.join(", ")}\n${t}`
        );
        assert.ok(
          t.length > emptyLen + 60,
          `full clinical letter not materially longer (empty=${emptyLen}, full=${t.length})`
        );
      }
    );
  });
});
