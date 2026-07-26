/**
 * Phase 5 — strategy stubs + authority expansion.
 * Run: npm run test:phase5
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmPath, assertLlmThrice } from "./_helpers/assertLlm";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../../lib/appeal/__fixtures__/cigna";
import { getRecordById } from "../../lib/appeal/authorities/records";
import { getAuthoritiesForLedger } from "../../lib/appeal/authorities/gate";
import { normalizeAuthorityText } from "../../lib/appeal/letter/assembler";
import { BUNDLING_STRATEGY } from "../../lib/appeal/router/strategies";
import {
  evaluateExportGate,
  generateAppealLetter,
  routeDenial,
  setFact,
  validateLetter,
} from "../../lib/appeal/netlify-entry";

function baseLedger(carc: string | string[]) {
  let L = cignaFullRequiredLedger();
  L = setFact(
    L,
    "claim.carcCodes",
    Array.isArray(carc) ? carc : [carc],
    "document",
    "doc:test:carc",
    0.9
  );
  L = setFact(L, "patient.planType", "erisa-self-funded", "user", "wizard:step3:planType", 1);
  return L;
}

function withClinical(L: ReturnType<typeof baseLedger>) {
  for (const [k, v] of CLINICAL_ALL) {
    L = setFact(L, k, v as string, "user", `wizard:step3:${k}`, 1);
  }
  return L;
}

describe("Phase 5 — strategies + authorities (generator-independent)", () => {
  it("1. routeDenial CO-50 → medical-necessity", () => {
    const route = routeDenial(baseLedger("50"));
    assert.equal(route.strategy.id, "medical-necessity");
  });

  it("2. routeDenial CO-97 → bundling", () => {
    const route = routeDenial(baseLedger("97"));
    assert.equal(route.strategy.id, "bundling");
  });

  it("3. routeDenial CO-29 → timely-filing", () => {
    const route = routeDenial(baseLedger("29"));
    assert.equal(route.strategy.id, "timely-filing");
  });

  it("4. necessity_denial_requires_diagnosis fires when primaryDiagnosis null", () => {
    let L = baseLedger("50");
    delete L.facts["clinical.primaryDiagnosis"];
    for (const k of CLINICAL_ALL.map(([key]) => key)) {
      if (k !== "clinical.primaryDiagnosis") {
        const entry = CLINICAL_ALL.find(([key]) => key === k);
        if (entry) {
          L = setFact(L, k, entry[1] as string, "user", `wizard:step3:${k}`, 1);
        }
      }
    }
    assert.ok(
      validateLetter("", L).some((e) => e.rule === "necessity_denial_requires_diagnosis")
    );
  });

  it("5. necessity_denial_requires_diagnosis clears when diagnosis supplied", () => {
    const L = withClinical(baseLedger("50"));
    assert.equal(
      validateLetter("", L).filter((e) => e.rule === "necessity_denial_requires_diagnosis")
        .length,
      0
    );
  });

  it("6. bundling branch question for CO-97; authorization for CO-15", () => {
    const co97 = routeDenial(baseLedger("97"));
    assert.equal(co97.strategy.branchQuestion, BUNDLING_STRATEGY.branchQuestion);
    const co15 = routeDenial(baseLedger("CO-15"));
    assert.equal(co15.strategy.id, "authorization");
    assert.notEqual(co15.strategy.branchQuestion, BUNDLING_STRATEGY.branchQuestion);
  });

  it("7. timely_filing_proof_grounded warning when proof branch without enclosure", () => {
    let L = baseLedger("29");
    L = setFact(
      L,
      "appeal.timelyFilingBranch",
      "proof-of-timely-submission",
      "user",
      "wizard:step3:timelyFilingBranch",
      1
    );
    const warnings = validateLetter("", L).filter(
      (e) => e.rule === "timely_filing_proof_grounded"
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.severity, "warning");
    const exportErrors = evaluateExportGate("", L);
    assert.ok(
      !exportErrors.some((e) => e.rule === "timely_filing_proof_grounded")
    );
  });

  it("8. UHC payer + CPT 27447 → UHC knee + AAOS knee; excludes Cigna/hip", () => {
    let L = baseLedger("50");
    L = setFact(L, "claim.payerName", "UnitedHealthcare", "document", "doc:test:payer", 0.9);
    L = setFact(L, "claim.cptCodes", ["27447"], "document", "doc:test:cpt", 0.9);
    const recs = getAuthoritiesForLedger(L);
    const ids = recs.map((r) => r.id);
    assert.ok(ids.includes("uhc-coverage-policy-knee-arthroplasty"));
    assert.ok(ids.includes("aaos-guideline-knee-arthroplasty"));
    assert.ok(!ids.includes("cigna-coverage-policy-hip-arthroplasty"));
    assert.ok(!ids.includes("cigna-coverage-policy-knee-arthroplasty"));
  });

  it("9. BCBS payer + CPT 27130 → BCBS hip; excludes Cigna/UHC", () => {
    let L = baseLedger("50");
    L = setFact(L, "claim.payerName", "Anthem Blue Cross", "document", "doc:test:payer", 0.9);
    L = setFact(L, "claim.cptCodes", ["27130"], "document", "doc:test:cpt", 0.9);
    const ids = getAuthoritiesForLedger(L).map((r) => r.id);
    assert.ok(ids.includes("bcbs-coverage-policy-hip-arthroplasty"));
    assert.ok(!ids.includes("cigna-coverage-policy-hip-arthroplasty"));
    assert.ok(!ids.includes("uhc-coverage-policy-hip-arthroplasty"));
  });

  it("10. unknown payer + CPT 27130 → all three hip payer policies", () => {
    let L = baseLedger("50");
    L = setFact(L, "claim.payerName", "Humana Health", "document", "doc:test:payer", 0.9);
    L = setFact(L, "claim.cptCodes", ["27130"], "document", "doc:test:cpt", 0.9);
    const payerPolicies = getAuthoritiesForLedger(L).filter((r) => r.payer);
    const payerIds = payerPolicies.map((r) => r.id);
    assert.ok(payerIds.includes("cigna-coverage-policy-hip-arthroplasty"));
    assert.ok(payerIds.includes("uhc-coverage-policy-hip-arthroplasty"));
    assert.ok(payerIds.includes("aetna-coverage-policy-hip-arthroplasty"));
  });
});

describe("Phase 5 — LLM strategy letters (gpt-4o ×3)", () => {
  it("11. CO-50 ERISA + clinical → clinical leads, criteria match, payer burden", async () => {
    const ledger = withClinical(baseLedger("50"));
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const after = result.text.split(/To the Appeals Review Department:?\s*\n/i)[1] || "";
        const paras = after.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const narrativeStart = paras.findIndex((p) =>
          /osteoarthritis|M16\.11|diagnosis|conservative|functional/i.test(p)
        );
        const denialIdx = paras.findIndex((p) => /non-covered|medical necessity|CO-50|deemed/i.test(p));
        assert.ok(narrativeStart >= 0 && denialIdx >= 0);
        assert.ok(narrativeStart < denialIdx + 2, "clinical should lead or follow denial basis closely");
        assert.match(result.text, /conservative|functional|diagnosis/i);
        assert.match(
          result.text,
          /specific clinical criterion|conclusory|valid adverse benefit determination|unmet criterion/i
        );
      }
    );
  });

  it("12. CO-50 ERISA no clinical → export gate blocks necessity_denial_requires_diagnosis", async () => {
    let L = baseLedger("50");
    for (const k of CLINICAL_ALL.map(([key]) => key)) {
      delete L.facts[k];
    }
    await assertLlmThrice(
      () =>
        generateAppealLetter(L, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assertLlmPath(result);
        const blocked = evaluateExportGate(result.text, L);
        assert.ok(
          blocked.some((e) => e.rule === "necessity_denial_requires_diagnosis"),
          blocked.map((e) => e.rule).join(", ")
        );
      }
    );
  });

  it("13. CO-97 modifier-59 branch → modifier 59 argument; no medical necessity lead", async () => {
    let L = baseLedger("97");
    L = setFact(L, "appeal.bundlingBranch", "modifier-59", "user", "wizard:step3:bundlingBranch", 1);
    await assertLlmThrice(
      () =>
        generateAppealLetter(L, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(result.text, /modifier 59|Modifier 59|X\{EPSU\}|distinct procedural service/i);
        const opening = result.text.split(/To the Appeals Review Department:?\s*\n/i)[1]?.slice(0, 800) || "";
        assert.ok(!/medical necessity denial|not medically necessary/i.test(opening));
      }
    );
  });

  it("14. CO-29 proof branch → submission record argument; warning without proof enclosure", async () => {
    let L = baseLedger("29");
    L = setFact(L, "patient.planType", "fully-insured-group", "user", "wizard:step3:planType", 1);
    L = setFact(
      L,
      "appeal.timelyFilingBranch",
      "proof-of-timely-submission",
      "user",
      "wizard:step3:timelyFilingBranch",
      1
    );
    await assertLlmThrice(
      () =>
        generateAppealLetter(L, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(
          result.text,
          /submitted within|submission record|contractual filing period|transmission report|electronic remittance/i
        );
        const warnings = validateLetter(result.text, L).filter(
          (e) => e.rule === "timely_filing_proof_grounded"
        );
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0]?.severity, "warning");
      }
    );
  });

  it("15. CO-50 fully-insured Cigna CPT 27130 → Cigna + AAOS verbatim; no ERISA", async () => {
    let L = withClinical(baseLedger("50"));
    L = setFact(L, "patient.planType", "fully-insured-group", "user", "wizard:step3:planType", 1);
    const cigna = getRecordById("cigna-coverage-policy-hip-arthroplasty");
    const aaos = getRecordById("aaos-guideline-hip-arthroplasty");
    assert.ok(cigna && aaos);
    await assertLlmThrice(
      () =>
        generateAppealLetter(L, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const norm = normalizeAuthorityText(result.text);
        assert.ok(norm.includes(normalizeAuthorityText(cigna!.argument)));
        assert.ok(norm.includes(normalizeAuthorityText(aaos!.argument)));
        assert.ok(!/\bERISA\b/.test(result.text));
        assert.ok(
          result.text.includes("45 C.F.R. § 147.136") ||
            /Independent Review Organization/i.test(result.text)
        );
      }
    );
  });
});
