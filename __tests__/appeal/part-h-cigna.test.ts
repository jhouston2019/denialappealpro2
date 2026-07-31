// To run: add real OPENAI_API_KEY to .env.test then run:
// npx jest phase1 --runInBand
/**
 * Phase 1.6 Part H — Cigna fixture tests.
 * Tests 3–6 run against gpt-4o (×3, nondeterminism guard). Fail closed without OPENAI_API_KEY.
 * Wired into: npm run test:phase1
 *
 * Preflight loads .env.test via scripts/phase1-preflight.mjs.
 * With a placeholder/invalid key, tests fail loudly (Invalid API key / 401), never silent pass.
 */

import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import "./_helpers/loadTestEnv";
import { assertLlmThrice } from "./_helpers/assertLlm";
import {
  buildLedgerFromExtraction,
  CLINICAL_KEYS,
  deterministicGroundedDraft,
  evaluateExportGate,
  finalizeLetter,
  generateAppealLetter,
  isDateShapedString,
  setFact,
  emptyLedger,
  validateLetter,
} from "../../lib/appeal/netlify-entry";
import {
  cignaExtractionFields,
  cignaFullRequiredLedger,
  cignaLetterALedger,
  cignaLetterBLedger,
  CIGNA_RAW_DENIAL_TEXT,
} from "../../lib/appeal/__fixtures__/cigna";
import { assembleSignatureBlock } from "../../lib/appeal/letter/signature";

const FORBIDDEN_CLINICAL =
  /\b(osteoarthritis|emergent|urgent|conservative\s+management|functional\s+impairment)\b/i;
const FORBIDDEN_ENCLOSURE = /\b(enclosed|herewith|attached|please\s+find)\b/i;

async function invokeExport(
  kind: "pdf" | "docx",
  text: string,
  ledger: unknown
) {
  process.env.WIZARD_ALLOW_BYPASS = "true";
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  const mod =
    kind === "pdf"
      ? await import("../../netlify/functions/generate-pdf.js")
      : await import("../../netlify/functions/generate-docx.js");
  const handler = mod.handler || mod.default?.handler;
  assert.equal(typeof handler, "function");
  return handler({
    httpMethod: "POST",
    headers: { authorization: "Bearer bypass" },
    body: JSON.stringify({
      text,
      fileName: kind === "pdf" ? "appeal.pdf" : "appeal.docx",
      ledger,
    }),
  });
}

describe("Part H — Cigna fixture (CIG-2026-887731)", () => {
  before(() => {
    process.env.WIZARD_ALLOW_BYPASS = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  });

  it("1. setFact(clinical.primaryDiagnosis, …, document) throws via canonical builder (netlify-entry)", () => {
    assert.throws(
      () =>
        setFact(
          emptyLedger(["cigna"]),
          "clinical.primaryDiagnosis",
          "M16.11",
          "document",
          "doc:cigna:p1:diagnosis"
        ),
      /Clinical fact .*provenance "user"/
    );
  });

  it("2. Extraction yields zero non-null clinical.* facts (canonical builder entry point)", () => {
    const { ledger } = buildLedgerFromExtraction({
      fields: cignaExtractionFields(),
      rawText: CIGNA_RAW_DENIAL_TEXT,
      documentId: "cigna-eob.pdf",
    });
    for (const key of CLINICAL_KEYS) {
      const fact = ledger.facts[key];
      assert.equal(
        fact,
        undefined,
        `clinical key ${key} must not be written by extraction`
      );
    }
  });

  it("3. No clinical input → letter has no osteoarthritis/emergent/urgent/conservative management/functional impairment (LLM ×3)", async () => {
    await assertLlmThrice(
      () =>
        generateAppealLetter(cignaLetterALedger(), {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.equal(FORBIDDEN_CLINICAL.test(result.text), false, result.text);
      }
    );
  });

  it("4. Generated letter contains none of: enclosed, herewith, attached, please find (LLM ×3)", async () => {
    await assertLlmThrice(
      () =>
        generateAppealLetter(cignaLetterALedger(), {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const body = result.text.replace(/\n\s*Enclosures:\s*\n[\s\S]*$/i, "");
        assert.equal(FORBIDDEN_ENCLOSURE.test(body), false, body);
      }
    );
  });

  it("5. Generated letter contains no unapproved citation hits (LLM ×3)", async () => {
    await assertLlmThrice(
      () =>
        generateAppealLetter(cignaLetterALedger(), {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        const errors = validateLetter(result.text, cignaLetterALedger());
        assert.equal(
          errors.filter((e) => e.rule === "no_unapproved_citations").length,
          0,
          errors.map((e) => e.message).join("; ")
        );
      }
    );
  });

  it("6. Generated letter contains at least one [[REQUIRED: token when required facts are missing (LLM ×3)", async () => {
    const sparse = emptyLedger(["cigna-sparse"]);
    await assertLlmThrice(
      () =>
        generateAppealLetter(sparse, {
          allowDeterministicFallback: false,
          model: "gpt-4o",
        }),
      (result) => {
        assert.match(result.text, /\[\[REQUIRED:/);
      }
    );
  });

  it("7. generate-pdf and generate-docx return 422 with non-empty errors array while placeholders remain", async () => {
    const ledger = cignaLetterALedger();
    const letter =
      "Appeal for claim CIG-2026-887731. Member [[REQUIRED: patient.memberId — Member ID]].";
    for (const kind of ["pdf", "docx"] as const) {
      const res = await invokeExport(kind, letter, ledger);
      assert.ok(res, `${kind} handler response`);
      assert.equal(res.statusCode, 422, `${kind} status`);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.errors), `${kind} errors array`);
      assert.ok(body.errors.length > 0, `${kind} errors non-empty`);
      assert.ok(
        body.errors.some(
          (e: { rule: string }) => e.rule === "no_unresolved_placeholders"
        ),
        `${kind} placeholder rule`
      );
    }
  });

  it("8. Full facts + enclosures → validation passes, exports 200, Enclosures block matches", async () => {
    const ledger = cignaLetterBLedger();
    // Export / enclosure structure is generator-independent; use deterministic for speed.
    const letter = deterministicGroundedDraft(ledger).text;
    const gate = evaluateExportGate(letter, ledger);
    assert.deepEqual(gate, [], gate.map((e) => e.message).join("; "));

    assert.match(
      letter,
      /Enclosures:\n- Operative report\n- Office\/progress notes\n- Copy of the EOB \/ remittance advice/
    );

    for (const kind of ["pdf", "docx"] as const) {
      const res = await invokeExport(kind, letter, ledger);
      assert.ok(res, `${kind} handler response`);
      assert.equal(res.statusCode, 200, `${kind} ${res.body?.slice?.(0, 200)}`);
    }
  });

  it("9. Golden letter (a) and (b) bodies are not byte-identical; (b) is materially longer", () => {
    const a = deterministicGroundedDraft(cignaLetterALedger()).text;
    const b = deterministicGroundedDraft(cignaLetterBLedger()).text;
    const stripEnc = (t: string) =>
      t.replace(/\n\s*Enclosures:\s*\n[\s\S]*$/i, "").trim();
    const aBody = stripEnc(a);
    const bBody = stripEnc(b);
    assert.notEqual(aBody, bBody, "bodies must differ outside enclosures");
    assert.ok(
      bBody.length > aBody.length + 80,
      `letter (b) must be materially longer (a=${aBody.length}, b=${bBody.length})`
    );
    assert.match(a, /\[\[REQUIRED:/);
    assert.ok(evaluateExportGate(a, cignaLetterALedger()).length > 0);
    assert.deepEqual(evaluateExportGate(b, cignaLetterBLedger()), []);
    for (const needle of [
      "Primary osteoarthritis of right hip",
      "M16.11",
      "Six months PT",
      "intra-articular corticosteroid injection",
      "NSAIDs",
      "Unable to ambulate more than 50 feet",
      "End-stage degenerative joint disease",
      "Activity modification",
    ]) {
      assert.ok(
        b.toLowerCase().includes(needle.toLowerCase()) ||
          b.includes(needle),
        `letter (b) missing clinical fact fragment: ${needle}`
      );
    }
  });
});

describe("Part B — signature_block_not_date regression", () => {
  it("binds signature from signer.* not date", () => {
    const ledger = cignaFullRequiredLedger();
    const block = assembleSignatureBlock(ledger);
    assert.match(block, /^Sincerely,\nJordan Hale\nAppeals Coordinator/m);
    assert.equal(isDateShapedString("Jordan Hale"), false);
  });

  it("fires when date is deliberately bound into signer.name", () => {
    let ledger = cignaFullRequiredLedger();
    ledger = setFact(
      ledger,
      "signer.name",
      "February 28, 2026",
      "user",
      "wizard:step3:signerNameBug",
      1
    );
    const letter = finalizeLetter(
      "We appeal claim CIG-2026-887731 for CPT 27130 denied under CARC 15.\n\nSincerely,\nFebruary 28, 2026",
      ledger
    );
    const errors = validateLetter(letter, ledger);
    assert.ok(
      errors.some((e) => e.rule === "signature_block_not_date"),
      errors.map((e) => e.message).join("; ")
    );
  });

  it("fires when signature slot line is date-shaped even if ledger name is ok", () => {
    const ledger = cignaFullRequiredLedger();
    const tainted =
      "We appeal claim CIG-2026-887731.\n\nSincerely,\nJuly 24, 2026\nAppeals Coordinator";
    const errors = validateLetter(tainted, ledger);
    assert.ok(
      errors.some((e) => e.rule === "signature_block_not_date"),
      errors.map((e) => e.message).join("; ")
    );
  });
});

describe("Part B — clinical_claims_grounded + no_contract_breach_allegation + internal grounding", () => {
  it("clinical_claims_grounded fires on osteoarthritis with null clinical.*", () => {
    const ledger = cignaLetterALedger();
    const letter =
      "Patient has osteoarthritis requiring urgent total hip arthroplasty that is medically necessary.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "clinical_claims_grounded"));
  });

  it("no_contract_breach_allegation fires on breach/violation/participation agreement", () => {
    const ledger = cignaLetterALedger();
    const letter =
      "This denial is a breach of the participation agreement and violates plan terms.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "no_contract_breach_allegation"));
  });

  it("no_internal_grounding_language fires on leaked grounding sentence", () => {
    const ledger = cignaLetterALedger();
    const letter =
      "No clinical narrative is offered beyond the procedure code 27130 as billed.\n\nSincerely,\nJordan Hale";
    const errors = validateLetter(letter, ledger);
    assert.ok(errors.some((e) => e.rule === "no_internal_grounding_language"));
  });

  it("all_required_facts_rendered fires when payer address is omitted from letter", () => {
    const ledger = cignaFullRequiredLedger();
    const letter =
      "We appeal claim CIG-2026-887731 for James Whitfield member CIG987654321 DOS February 28, 2026 CPT 27130 billed $22,000.00 denied $22,000.00 CARC CO-15. Riverside Medical Group NPI 1568890123 phone 423-555-0144. Sincerely,\nJordan Hale\nAppeals Coordinator";
    const errors = validateLetter(letter, ledger);
    assert.ok(
      errors.some(
        (e) =>
          e.rule === "all_required_facts_rendered" &&
          e.factKey === "claim.payerAppealAddress"
      ),
      errors.map((e) => e.message).join("; ")
    );
  });
});
