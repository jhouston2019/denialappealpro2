/**
 * Fact ledger builder — clinical provenance invariant.
 * Run: npx tsx --test lib/appeal/ledger/__tests__/builder.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyLedger, setFact } from "../builder";

describe("setFact clinical invariant", () => {
  it("throws when a clinical.* key is written with non-user provenance", () => {
    const ledger = emptyLedger();
    assert.throws(
      () =>
        setFact(
          ledger,
          "clinical.primaryDiagnosis",
          "M54.5",
          "document",
          "doc:test:p1:diagnosis"
        ),
      /Clinical fact .* may only be written with provenance "user"/
    );
  });

  it("throws for library and derived provenance on clinical keys", () => {
    const ledger = emptyLedger();
    for (const provenance of ["library", "derived"] as const) {
      assert.throws(
        () =>
          setFact(
            ledger,
            "clinical.urgency",
            "emergent",
            provenance,
            `${provenance}:x`
          ),
        /Clinical fact/
      );
    }
  });

  it("allows clinical.* with provenance user", () => {
    const ledger = emptyLedger();
    const next = setFact(
      ledger,
      "clinical.icd10Codes",
      ["M54.5"],
      "user",
      "wizard:step3:icd10"
    );
    assert.deepEqual(next.facts["clinical.icd10Codes"]?.value, ["M54.5"]);
    assert.equal(next.facts["clinical.icd10Codes"]?.provenance, "user");
    assert.equal(next.facts["clinical.icd10Codes"]?.confidence, 1);
  });
});
