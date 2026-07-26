/**
 * Phase 4 — authority library expansion + letter assembly spec.
 * Run: npm run test:phase4
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice } from "./_helpers/assertLlm";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../../lib/appeal/__fixtures__/cigna";
import { getRecordById } from "../../lib/appeal/authorities/records";
import {
  assembleLetter,
  assembleLetterParts,
  normalizeAuthorityText,
} from "../../lib/appeal/letter/assembler";
import type { AuthBranchId } from "../../lib/appeal/router/strategies";
import type { PlanType } from "../../lib/appeal/ledger/types";
import {
  generateAppealLetter,
  getAuthorities,
  setFact,
  validateLetter,
} from "../../lib/appeal/netlify-entry";

function cignaCpt27130Ledger(
  branch: AuthBranchId = "D",
  planType: PlanType = "erisa-self-funded",
  strategy: "authorization" | "medical-necessity" | "bundling" = "authorization",
  clinical = true,
  enclosures = false
) {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", strategy === "medical-necessity" ? ["50"] : ["CO-15"], "document", "doc:test:carc", 0.9);
  if (strategy === "bundling") {
    L = setFact(L, "claim.carcCodes", ["97"], "document", "doc:test:carc", 0.9);
  }
  L = setFact(L, "appeal.authBranch", branch, "user", "wizard:step3:authBranch", 1);
  L = setFact(L, "patient.planType", planType, "user", "wizard:step3:planType", 1);
  if (clinical) {
    for (const [k, v] of CLINICAL_ALL) {
      L = setFact(L, k, v as string, "user", `wizard:step3:${k}`, 1);
    }
  }
  if (enclosures) {
    const checked = new Set(["operative_report", "office_notes", "eob_copy"]);
    L = {
      ...L,
      enclosures: L.enclosures.map((e) => ({
        ...e,
        checked: checked.has(e.id),
      })),
    };
  }
  return L;
}

function minimalLetterBody(opening: string): string {
  return `To the Appeals Review Department:\n\n${opening}\n\nSincerely,\nJordan Hale`;
}

describe("Phase 4 — assembly + authority library (generator-independent)", () => {
  it("1. getAuthorities with Cigna ledger returns Cigna policy + ERISA + AAOS hip; excludes UHC/Aetna", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true);
    const recs = getAuthorities("erisa-self-funded", "authorization", "D", ledger);
    const ids = recs.map((r) => r.id);
    assert.ok(ids.includes("cigna-coverage-policy-hip-arthroplasty"));
    assert.ok(ids.includes("aaos-guideline-hip-arthroplasty"));
    assert.ok(ids.includes("erisa-503-full-fair-review"));
    assert.ok(!ids.includes("uhc-coverage-policy-hip-arthroplasty"));
    assert.ok(!ids.includes("aetna-coverage-policy-hip-arthroplasty"));
  });

  it("2. getAuthorities bundling returns NCCI + CPT guidelines", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "bundling", false);
    const recs = getAuthorities("erisa-self-funded", "bundling", "D", ledger);
    const ids = recs.map((r) => r.id);
    assert.ok(ids.includes("ncci-policy-manual-medical-necessity"));
    assert.ok(ids.includes("cpt-guidelines-separate-procedure"));
  });

  it("3. assembly spec: relief before claim summary before denial basis before strategy", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true);
    const narrative = [
      "We request reversal of the denial and payment at the contracted rate.",
      "Claim CIG-2026-887731 was submitted for CPT 27130 on February 28, 2026.",
      "The payer denied citing CARC CO-15 for missing authorization.",
      "No prior authorization was obtained; we argue retroactive authorization, notice waiver, and disproportionate remedy.",
    ].join("\n\n");
    const parts = assembleLetterParts(
      ledger,
      narrative,
      getAuthorities("erisa-self-funded", "authorization", "D", ledger)
    );
    const n = parts.narrative;
    const iRelief = n.indexOf("reversal");
    const iClaim = n.indexOf("Claim CIG");
    const iDenial = n.indexOf("payer denied");
    const iStrategy = n.indexOf("retroactive authorization");
    assert.ok(iRelief < iClaim && iClaim < iDenial && iDenial < iStrategy);
    assert.ok(parts.full.includes("Procedural Obligations"));
    assert.ok(parts.full.includes("Escalation"));
  });

  it("4. authority text in assembled letter matches record argument verbatim", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true);
    const authorities = getAuthorities("erisa-self-funded", "authorization", "D", ledger);
    const cigna = getRecordById("cigna-coverage-policy-hip-arthroplasty");
    assert.ok(cigna);
    const narrative = "We request reprocessing at the contracted rate.\n\nClaim summary.\n\nDenial basis.\n\nStrategy.";
    const letter = assembleLetter(ledger, narrative, authorities);
    assert.ok(
      normalizeAuthorityText(letter).includes(normalizeAuthorityText(cigna!.argument))
    );
  });

  it("5. relief_requested_first fires when opening is claim summary not relief", () => {
    const ledger = cignaCpt27130Ledger("D");
    const letter = minimalLetterBody(
      "Claim CIG-2026-887731 was billed for CPT 27130 on February 28, 2026 with denied amount $22,000.00."
    );
    assert.ok(
      validateLetter(letter, ledger).some((e) => e.rule === "relief_requested_first")
    );
  });

  it("6. no_billed_charges_demand fires on billed demand; clears on contracted rate", () => {
    const ledger = cignaCpt27130Ledger("D");
    const bad = minimalLetterBody(
      "We demand payment of $22,000.00 for claim CIG-2026-887731."
    );
    assert.ok(
      validateLetter(bad, ledger).some((e) => e.rule === "no_billed_charges_demand")
    );
    const good = minimalLetterBody(
      "We request payment at the contracted rate for claim CIG-2026-887731."
    );
    assert.equal(
      validateLetter(good, ledger).filter((e) => e.rule === "no_billed_charges_demand")
        .length,
      0
    );
  });

  it("7. escalation_plan_correct fires when ERISA letter lacks § 502(a)", () => {
    const ledger = cignaCpt27130Ledger("D");
    const letter = minimalLetterBody(
      "We request reprocessing of claim CIG-2026-887731 at the contracted rate."
    );
    assert.ok(
      validateLetter(letter, ledger).some((e) => e.rule === "escalation_plan_correct")
    );
  });

  it("8. authority_text_verbatim fires when authority paragraph is paraphrased", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true);
    const cigna = getRecordById("cigna-coverage-policy-hip-arthroplasty");
    assert.ok(cigna);
    const paraphrase = cigna!.argument.replace(
      "Cigna's own Medical Coverage Policy",
      "Cigna policy documents"
    );
    const narrative = "We request reprocessing at the contracted rate.";
    const letter = assembleLetter(ledger, narrative, [
      { ...cigna!, argument: paraphrase },
    ]);
    assert.ok(
      validateLetter(letter, ledger).some((e) => e.rule === "authority_text_verbatim")
    );
  });

  it("9. payer_policy_present_when_eligible fires when Cigna policy omitted", () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "medical-necessity", true);
    const authorities = getAuthorities(
      "erisa-self-funded",
      "medical-necessity",
      "D",
      ledger
    );
    assert.ok(authorities.some((r) => r.id === "cigna-coverage-policy-hip-arthroplasty"));
    const nonPayer = authorities.filter((r) => !r.payer);
    const narrative = "We request reconsideration at the contracted rate.";
    const letter = assembleLetter(ledger, narrative, nonPayer);
    assert.ok(
      validateLetter(letter, ledger).some(
        (e) => e.rule === "payer_policy_present_when_eligible"
      )
    );
  });

  it("10. enclosures absent when nothing checked; present when checked", () => {
    let ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true, false);
    const narrative = "We request reprocessing at the contracted rate.";
    let letter = assembleLetter(
      ledger,
      narrative,
      getAuthorities("erisa-self-funded", "authorization", "D", ledger)
    );
    assert.ok(!/Enclosures:/i.test(letter));

    ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true, true);
    letter = assembleLetter(
      ledger,
      narrative,
      getAuthorities("erisa-self-funded", "authorization", "D", ledger)
    );
    assert.ok(/Enclosures:/i.test(letter));
    assert.ok(letter.includes("- Operative report"));
  });
});

describe("Phase 4 — LLM assembly letters (gpt-4o ×3)", () => {
  it("11. ERISA CO-15 Branch D — relief requested is first paragraph", async () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true, true);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const after = result.text.split(/To the Appeals Review Department:?\s*\n/i)[1] || "";
        const firstBlock = after.trim().split(/\n\s*\n/)[0] || "";
        assert.ok(firstBlock.length > 10, "missing first narrative paragraph");
        assert.match(
          firstBlock,
          /\b(reprocess(?:ed|ing)?|reverse|pay(?:ment|able)?|reconsider(?:ation)?|remit(?:tance)?|overturn)\b/i
        );
      }
    );
  });

  it("12. ERISA CO-15 Branch D — Cigna payer policy argument verbatim", async () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true, true);
    const cigna = getRecordById("cigna-coverage-policy-hip-arthroplasty");
    assert.ok(cigna);
    const needle = normalizeAuthorityText(cigna!.argument);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.ok(
          normalizeAuthorityText(result.text).includes(needle),
          "Cigna payer policy argument not verbatim"
        );
      }
    );
  });

  it("13. ERISA Branch D — AAOS hip guideline verbatim when clinical facts supplied", async () => {
    const ledger = cignaCpt27130Ledger("D", "erisa-self-funded", "authorization", true, true);
    const aaos = getRecordById("aaos-guideline-hip-arthroplasty");
    assert.ok(aaos);
    const needle = normalizeAuthorityText(aaos!.argument);
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.ok(
          normalizeAuthorityText(result.text).includes(needle),
          "AAOS hip guideline not verbatim"
        );
      }
    );
  });

  it("14. Fully-insured CO-15 Branch D — no ERISA; ACA external review present", async () => {
    const ledger = cignaCpt27130Ledger(
      "D",
      "fully-insured-group",
      "authorization",
      true,
      false
    );
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text;
        assert.ok(!/\bERISA\b/.test(t), "ERISA must not appear on fully-insured letter");
        assert.ok(
          t.includes("45 C.F.R. § 147.136") ||
            t.includes("Independent Review Organization"),
          "missing ACA external review"
        );
      }
    );
  });

  it("15. Strategy argument present and non-empty for all four auth branches", async () => {
    for (const branch of ["A", "B", "C", "D"] as AuthBranchId[]) {
      let ledger = cignaCpt27130Ledger(branch, "erisa-self-funded", "authorization", true);
      if (branch === "A" || branch === "C") {
        ledger = setFact(
          ledger,
          "claim.authorizationNumber",
          "AUTH-2026-998877",
          "user",
          "wizard:step3:auth",
          1
        );
      }
      if (branch === "B") {
        ledger = setFact(
          ledger,
          "clinical.procedureNarrative",
          "Intraoperative findings required conversion to total hip arthroplasty CPT 27130.",
          "user",
          "wizard:step3:procedureNarrative",
          1
        );
      }
      await assertLlmThrice(
        () =>
          generateAppealLetter(ledger, {
            allowDeterministicFallback: false,
            model: "gpt-4o",
          }),
        (result) => {
          const body = result.text.split(/To the Appeals Review Department:?\s*\n/i)[1] || "";
          assert.ok(body.length > 200, `branch ${branch}: narrative too short`);
          assert.match(
            body,
            /\b(reprocess|authorization|retro|notice|disproportionate|intraoperative|provider|TIN|corrected claim)\b/i,
            `branch ${branch}: missing strategy argument thread`
          );
        }
      );
    }
  });
});
