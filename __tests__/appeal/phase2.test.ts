/**
 * Phase 2 — denial-type router tests.
 * Run: npm run test:phase2
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice } from "./_helpers/assertLlm";
import {
  emptyLedger,
  generateAppealLetter,
  routeDenial,
  setFact,
  validateLetter,
} from "../../lib/appeal/netlify-entry";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../../lib/appeal/__fixtures__/cigna";
import type { FactLedger } from "../../lib/appeal/ledger/types";
import type { AuthBranchId } from "../../lib/appeal/router/strategies";

function authLedger(
  branch: AuthBranchId | null,
  opts: {
    clinical?: boolean;
    authNumber?: string;
    carcs?: string[];
    planType?: import("../../lib/appeal/ledger/types").PlanType;
  } = {}
): FactLedger {
  let L = cignaFullRequiredLedger();
  const carcs = opts.carcs ?? ["CO-15"];
  L = setFact(L, "claim.carcCodes", carcs, "document", "doc:test:carc", 0.9);
  if (opts.planType) {
    L = setFact(
      L,
      "patient.planType",
      opts.planType,
      "user",
      "wizard:step3:planType",
      1
    );
  }
  if (branch) {
    L = setFact(L, "appeal.authBranch", branch, "user", "wizard:step3:authBranch", 1);
  }
  if (opts.authNumber) {
    L = setFact(
      L,
      "claim.authorizationNumber",
      opts.authNumber,
      "user",
      "wizard:step3:authorizationNumber",
      1
    );
  }
  if (opts.clinical) {
    for (const [k, v] of CLINICAL_ALL) {
      L = setFact(L, k, v as string, "user", `wizard:step3:${k}`, 1);
    }
  }
  return L;
}

function openingParagraph(text: string): string {
  const m = text.match(
    /To the Appeals Review Department:?\s*\n+([\s\S]{0,1200}?)(?:\n\s*\n|$)/i
  );
  return (m?.[1] ?? text.slice(0, 800)).trim();
}

describe("Phase 2 — router (generator-independent)", () => {
  it("1. routeDenial with CO-15 → authorization, isAdministrative true", () => {
    const route = routeDenial(authLedger("D"));
    assert.equal(route.strategy.id, "authorization");
    assert.equal(route.primaryCarc?.code, "15");
    assert.equal(route.primaryCarc?.isAdministrative, true);
  });

  it("2. routeDenial with 15 (no prefix) → same as CO-15", () => {
    const a = routeDenial(authLedger("D", { carcs: ["CO-15"] }));
    const b = routeDenial(authLedger("D", { carcs: ["15"] }));
    assert.equal(a.strategy.id, b.strategy.id);
    assert.equal(a.primaryCarc?.code, b.primaryCarc?.code);
    assert.equal(a.primaryCarc?.descriptor, b.primaryCarc?.descriptor);
  });

  it("3. routeDenial with unknown CARC ZZ99 → unknown + warning", () => {
    const route = routeDenial(authLedger(null, { carcs: ["ZZ99"] }));
    assert.equal(route.strategy.id, "unknown");
    assert.ok(route.unknownCarcs.length > 0);
    assert.ok(route.warnings.some((w) => w.includes("Unknown CARC")));
  });

  it("4. routeDenial with CO-15 + CO-50 → primary authorization", () => {
    const route = routeDenial(authLedger("D", { carcs: ["CO-15", "CO-50"] }));
    assert.equal(route.strategy.id, "authorization");
    assert.ok(route.resolvedStrategies.includes("medical-necessity"));
  });

  it("5. auth_branch_selected fires when branch null, clears when set", () => {
    const noBranch = authLedger(null);
    const letter = "To the Appeals Review Department:\n\nWe appeal claim CIG-2026-887731.\n\nSincerely,\nJordan Hale";
    const errA = validateLetter(letter, noBranch);
    assert.ok(errA.some((e) => e.rule === "auth_branch_selected"));
    const withBranch = authLedger("A", { authNumber: "AUTH-12345" });
    const errB = validateLetter(letter, withBranch);
    assert.equal(
      errB.filter((e) => e.rule === "auth_branch_selected").length,
      0
    );
  });

  it("6. no_necessity_lead_on_admin_denial fires on admin CARC + necessity lead", () => {
    const ledger = authLedger("D");
    const letter =
      "To the Appeals Review Department:\n\nThis is a medical necessity denial and the service was medically necessary.\n\nWe request payment.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "no_necessity_lead_on_admin_denial"));
  });
});

describe("Phase 2 — LLM strategy letters (gpt-4o ×3)", () => {
  it("7. Branch A — no medical necessity as lead argument (LLM ×3)", async () => {
    const ledger = authLedger("A", { authNumber: "PA-8844221" });
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const open = openingParagraph(result.text);
        assert.equal(
          /\b(medical necessity|medically necessary)\b/i.test(open),
          false,
          `Opening leads with medical necessity:\n${open}`
        );
        assert.match(result.text, /reprocess|reprocessing|processing error/i);
      }
    );
  });

  it("8. Branch D — retro-auth, notice/waiver, disproportionate remedy (LLM ×3)", async () => {
    const ledger = authLedger("D");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text.toLowerCase();
        assert.ok(
          /retro(?:active)?\s*auth/.test(t) || t.includes("retroactive authorization"),
          `retro-auth missing:\n${result.text}`
        );
        assert.ok(
          t.includes("notice") || t.includes("waiver") || t.includes("notify"),
          `notice/waiver missing:\n${result.text}`
        );
        assert.ok(
          t.includes("disproportionate") ||
            t.includes("disproportionate remedy") ||
            (t.includes("administrative") && t.includes("denial")),
          `disproportionate remedy thread missing:\n${result.text}`
        );
      }
    );
  });

  it("9. CO-15 — no covered-benefit or lack-of-information mischaracterization (LLM ×3)", async () => {
    const ledger = authLedger("D");
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const lower = result.text.toLowerCase();
        assert.equal(lower.includes("lack of information"), false, result.text);
        assert.equal(lower.includes("missing information"), false, result.text);
        assert.equal(lower.includes("not a covered benefit"), false, result.text);
        assert.equal(
          lower.includes("not deemed a covered benefit"),
          false,
          result.text
        );
      }
    );
  });

  it("10. Branch D + clinical — clinical section after administrative argument (LLM ×3)", async () => {
    const ledger = authLedger("D", { clinical: true });
    await assertLlmThrice(
      () =>
        generateAppealLetter(ledger, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const t = result.text.toLowerCase();
        const adminIdx = Math.min(
          ...[
            t.indexOf("retroactive"),
            t.indexOf("retroactive authorization"),
            t.indexOf("notice"),
            t.indexOf("waiver"),
            t.indexOf("disproportionate"),
            t.indexOf("administrative"),
          ].filter((i) => i >= 0)
        );
        const clinicalIdx = Math.min(
          ...[
            t.indexOf("osteoarthritis"),
            t.indexOf("m16.11"),
            t.indexOf("physical therapy"),
            t.indexOf("ambulat"),
            t.indexOf("degenerative"),
          ].filter((i) => i >= 0)
        );
        assert.ok(adminIdx >= 0, `administrative argument missing:\n${result.text}`);
        assert.ok(clinicalIdx >= 0, `clinical content missing:\n${result.text}`);
        assert.ok(
          clinicalIdx > adminIdx,
          `clinical section should follow administrative argument (admin@${adminIdx}, clinical@${clinicalIdx})`
        );
      }
    );
  });
});

describe("Phase 2 — empty ledger routing", () => {
  it("empty ledger routes to unknown", () => {
    const route = routeDenial(emptyLedger());
    assert.equal(route.strategy.id, "unknown");
  });
});
