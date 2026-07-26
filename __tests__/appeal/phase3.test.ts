/**
 * Phase 3 — plan-type authority gate tests.
 * Run: npm run test:phase3
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice } from "./_helpers/assertLlm";
import { ALLOWED_CITATION_STRINGS } from "../../lib/appeal/authorities/allowlist";
import { getRecordById } from "../../lib/appeal/authorities/records";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../../lib/appeal/__fixtures__/cigna";
import type { PlanType } from "../../lib/appeal/ledger/types";
import type { AuthBranchId } from "../../lib/appeal/router/strategies";
import {
  generateAppealLetter,
  getAuthorities,
  setFact,
  validateLetter,
} from "../../lib/appeal/netlify-entry";

function authLedger(
  branch: AuthBranchId,
  planType: PlanType,
  clinical = false
) {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", ["CO-15"], "document", "doc:test:carc", 0.9);
  L = setFact(L, "appeal.authBranch", branch, "user", "wizard:step3:authBranch", 1);
  L = setFact(L, "patient.planType", planType, "user", "wizard:step3:planType", 1);
  if (clinical) {
    for (const [k, v] of CLINICAL_ALL) {
      L = setFact(L, k, v as string, "user", `wizard:step3:${k}`, 1);
    }
  }
  return L;
}

describe("Phase 3 — authority gate (generator-independent)", () => {
  it("1. erisa-self-funded + authorization D → four ERISA + ACA external review", () => {
    const recs = getAuthorities("erisa-self-funded", "authorization", "D");
    const ids = recs.map((r) => r.id);
    assert.ok(ids.includes("erisa-503-full-fair-review"));
    assert.ok(ids.includes("erisa-503-deemed-exhaustion"));
    assert.ok(ids.includes("erisa-503-document-production"));
    assert.ok(ids.includes("erisa-502a-civil-action"));
    assert.ok(ids.includes("aca-external-review"));
    assert.equal(recs.length, 5);
  });

  it("2. fully-insured-group + authorization D → ACA only, no ERISA", () => {
    const recs = getAuthorities("fully-insured-group", "authorization", "D");
    assert.deepEqual(recs.map((r) => r.id), ["aca-external-review"]);
  });

  it("3. medicare-advantage + medical-necessity → MA records only", () => {
    const recs = getAuthorities("medicare-advantage", "medical-necessity");
    assert.ok(recs.some((r) => r.id === "ma-422-subpart-m"));
    assert.ok(recs.some((r) => r.id === "ma-ncd-binding"));
    assert.equal(recs.every((r) => !r.id.startsWith("erisa")), true);
  });

  it("4. unknown + authorization → empty array", () => {
    assert.deepEqual(getAuthorities("unknown", "authorization"), []);
  });

  it("5. no_blocked_authority fires when ERISA appears on fully-insured letter", () => {
    const ledger = authLedger("D", "fully-insured-group");
    const letter =
      "To the Appeals Review Department:\n\nUnder 29 U.S.C. § 1133; 29 C.F.R. § 2560.503-1 we appeal.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "no_blocked_authority"));
  });

  it("6. no_invented_authority fires for ERISA citation on medicare-advantage", () => {
    const ledger = authLedger("D", "medicare-advantage");
    const letter =
      "To the Appeals Review Department:\n\n29 U.S.C. § 1132 applies.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "no_invented_authority"));
  });

  it("7. unknown_plan_no_citations fires when citations present", () => {
    const ledger = authLedger("D", "unknown");
    const letter =
      "To the Appeals Review Department:\n\n45 C.F.R. § 147.136 applies.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "unknown_plan_no_citations"));
  });

  it("8. internal_routing_language fires on branch leak and plan type slugs", () => {
    const ledger = authLedger("A", "erisa-self-funded");
    const branchLetter =
      "To the Appeals Review Department:\n\nThe authorization status branch is A.\n\nSincerely,\nJordan Hale";
    assert.ok(
      validateLetter(branchLetter, ledger).some(
        (e) => e.rule === "internal_routing_language"
      )
    );
    const slugLetter =
      "To the Appeals Review Department:\n\nThis claim is under plan type erisa-self-funded.\n\nSincerely,\nJordan Hale";
    const slugErrors = validateLetter(slugLetter, ledger);
    assert.ok(
      slugErrors.some((e) => e.rule === "internal_routing_language"),
      slugErrors.map((e) => e.message).join("; ")
    );
    for (const slug of [
      "fully-insured-group",
      "medicare-advantage",
      "medicaid-mco",
      "marketplace-individual",
    ]) {
      const t = `Appeal for member under ${slug} plan.\n\nSincerely,\nJordan Hale`;
      assert.ok(
        validateLetter(t, ledger).some((e) => e.rule === "internal_routing_language"),
        `expected slug hit: ${slug}`
      );
    }
  });

  it("9. plan_type_selected fires when null, clears when set", () => {
    let ledger = authLedger("D", "erisa-self-funded");
    delete ledger.facts["patient.planType"];
    const letter =
      "To the Appeals Review Department:\n\nWe appeal claim CIG-2026-887731.\n\nSincerely,\nJordan Hale";
    assert.ok(
      validateLetter(letter, ledger).some((e) => e.rule === "plan_type_selected")
    );
    ledger = setFact(
      ledger,
      "patient.planType",
      "unknown",
      "user",
      "wizard:step3:planType",
      1
    );
    assert.equal(
      validateLetter(letter, ledger).filter((e) => e.rule === "plan_type_selected")
        .length,
      0
    );
  });

  it("10. Allowlist derived from records — new record citation is approved", () => {
    const rec = getRecordById("aca-external-review");
    assert.ok(rec);
    assert.ok(
      ALLOWED_CITATION_STRINGS.some((s) =>
        s.toLowerCase().includes("45 c.f.r.")
      )
    );
  });
});

describe("Phase 3 — LLM authority letters (gpt-4o ×3)", () => {
  it("11. ERISA self-funded Branch D — three ERISA citation strings verbatim (LLM ×3)", async () => {
    const ledger = authLedger("D", "erisa-self-funded");
    const needles = [
      "29 C.F.R. § 2560.503-1(l)",
      "29 C.F.R. § 2560.503-1(h)(2)(iii)",
    ];
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        for (const n of needles) {
          assert.ok(result.text.includes(n), `missing citation: ${n}\n${result.text}`);
        }
        const t = result.text;
        assert.ok(
          t.includes("29 U.S.C. § 1133; 29 C.F.R. § 2560.503-1") ||
            (/\b1133\b/.test(t) &&
              t.includes("29 C.F.R. § 2560.503-1") &&
              /ERISA/.test(t)),
          `missing primary ERISA citation components:\n${t}`
        );
      }
    );
  });

  it("12. ERISA self-funded — deemed-exhaustion argument present (LLM ×3)", async () => {
    const ledger = authLedger("D", "erisa-self-funded");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(
          result.text,
          /deemed to have exhausted internal administrative remedies|deemed exhaustion of internal administrative remedies/i
        );
      }
    );
  });

  it("13. Fully-insured Branch D — ACA external review, no ERISA (LLM ×3)", async () => {
    const ledger = authLedger("D", "fully-insured-group");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(result.text, /45 C\.F\.R\. § 147\.136/);
        assert.equal(/\bERISA\b/i.test(result.text), false, result.text);
        assert.equal(/29 U\.S\.C\./i.test(result.text), false, result.text);
      }
    );
  });

  it("14. Medicare Advantage — MA Subpart M, no ERISA (LLM ×3)", async () => {
    const ledger = authLedger("D", "medicare-advantage");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(result.text, /42 C\.F\.R\. Part 422, Subpart M/);
        assert.equal(/\bERISA\b/i.test(result.text), false, result.text);
        assert.equal(/29 U\.S\.C\./i.test(result.text), false, result.text);
      }
    );
  });

  it("15. Unknown plan type — no citation strings (LLM ×3)", async () => {
    const ledger = authLedger("D", "unknown");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.equal(/\d+\s+U\.S\.C\./i.test(result.text), false, result.text);
        assert.equal(/\d+\s+C\.F\.R\./i.test(result.text), false, result.text);
        assert.equal(/\bERISA\b/i.test(result.text), false, result.text);
      }
    );
  });
});
