/**
 * Adversarial suite — known-bad letters must fail the grounding validator.
 * Run: npm run test:phase1:adversarial
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyLedger, setFact } from "../ledger/builder";
import type { FactKey, FactLedger } from "../ledger/types";
import { appendEnclosuresBlock } from "../letter/enclosures";
import { validateLetter } from "../validate/index";

function fillRequired(overrides: Partial<Record<FactKey, string | string[]>> = {}): FactLedger {
  const base: Array<[FactKey, string | string[]]> = [
    ["claim.number", "ADV-1"],
    ["claim.payerName", "PayerCo"],
    ["claim.payerAppealAddress", "P.O. Box 99, Dallas, TX 75201"],
    ["claim.dateOfService", "2026-02-01"],
    ["claim.billedAmount", "500.00"],
    ["claim.deniedAmount", "500.00"],
    ["claim.carcCodes", ["97"]],
    ["claim.cptCodes", ["27447"]],
    ["patient.name", "Alex Patient"],
    ["patient.memberId", "MEM9"],
    ["provider.name", "Ortho Group"],
    ["provider.npi", "1999999999"],
    ["provider.addressBlock", "9 Bone Rd"],
    ["provider.phone", "555-0100"],
    ["signer.name", "Sam Signer"],
    ["signer.title", "CPC"],
  ];
  let L = emptyLedger(["adv"]);
  for (const [k, v] of base) {
    const val = overrides[k] ?? v;
    L = setFact(L, k, val, "user", `wizard:step3:${k}`, 1);
  }
  return L;
}

function rules(letter: string, ledger: FactLedger): string[] {
  return validateLetter(letter, ledger).map((e) => e.rule);
}

describe("adversarial: clinical invention", () => {
  it("does not allow clinical.* via document provenance (builder throws)", () => {
    assert.throws(
      () =>
        setFact(
          emptyLedger(),
          "clinical.urgency",
          "emergent",
          "document",
          "doc:x:p1:urgency"
        ),
      /Clinical fact/
    );
  });

  it("letter with invented diagnosis still fails export when placeholder/citation/enclosure rules hit", () => {
    const L = fillRequired();
    // Model invents diagnosis + cites NCD + mentions enclosure
    const letter =
      "The patient has severe lumbar stenosis requiring emergent fusion. " +
      "This is covered under NCD 150.10. Enclosed herewith is the operative report.";
    const r = rules(letter, L);
    assert.ok(r.includes("no_unapproved_citations"), r.join(","));
    assert.ok(r.includes("no_enclosure_reference_in_body"), r.join(","));
  });
});

describe("adversarial: citations", () => {
  it("rejects ACA / EMTALA / NCCI / AAOS / prompt-pay / insurance commissioner", () => {
    const L = fillRequired();
    const letter =
      "Denial violates the Affordable Care Act and EMTALA. " +
      "NCCI edits and AAOS guidelines plus state prompt-pay law require payment. " +
      "We will escalate to the insurance commissioner.";
    const r = rules(letter, L);
    assert.ok(r.includes("no_unapproved_citations"));
    const msgs = validateLetter(letter, L).map((e) => e.message).join(" | ");
    assert.match(msgs, /ACA|Affordable Care Act|EMTALA|NCCI|AAOS|prompt|commissioner/i);
  });
});

describe("adversarial: placeholders", () => {
  it("rejects [[REQUIRED: ...]] tokens", () => {
    const L = fillRequired();
    const letter =
      "Member ID [[REQUIRED: patient.memberId — Member ID]] must be reconsidered.";
    assert.ok(rules(letter, L).includes("no_unresolved_placeholders"));
  });
});

describe("adversarial: enclosure body leakage", () => {
  const phrases = [
    "Enclosed please find the chart notes.",
    "Attached please find supporting records.",
    "Please find attached the imaging.",
    "See attached documentation for details.",
    "Accompanying documents substantiate medical necessity.",
  ];

  for (const phrase of phrases) {
    it(`rejects body phrase: ${phrase.slice(0, 40)}`, () => {
      const L = fillRequired();
      assert.ok(
        rules(`We appeal. ${phrase}`, L).includes("no_enclosure_reference_in_body")
      );
    });
  }

  it("does not flag the system-rendered Enclosures: trailer alone", () => {
    const L = fillRequired();
    L.enclosures = [
      { id: "operative_report", label: "Operative report", checked: true },
      { id: "eob_copy", label: "Copy of the EOB / remittance advice", checked: true },
      { id: "imaging", label: "Imaging reports", checked: true },
    ];
    const letter = appendEnclosuresBlock(
      "We formally appeal claim ADV-1 for Alex Patient, DOS February 1, 2026, CPT 27447, denied under CARC 97 for billed amount 500.00.",
      L.enclosures
    );
    const r = rules(letter, L);
    assert.equal(r.includes("no_enclosure_reference_in_body"), false, r.join(","));
  });
});

describe("adversarial: missing required facts", () => {
  it("blocks export when signer.title absent", () => {
    let L = fillRequired();
    delete L.facts["signer.title"];
    const r = rules("Clean short appeal body with no citations.", L);
    assert.ok(r.includes("no_missing_required_facts"));
    assert.ok(
      validateLetter("Clean short appeal body with no citations.", L).some(
        (e) => e.factKey === "signer.title"
      )
    );
  });
});
