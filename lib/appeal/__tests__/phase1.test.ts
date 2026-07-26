/**
 * Phase 1 unit suite — builder, validate, citations, enclosures, adapter.
 * Run: npm run test:phase1
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ledgerToLegacyShape } from "../ledger/adapter";
import {
  emptyLedger,
  getValue,
  missingRequired,
  setFact,
} from "../ledger/builder";
import { ALWAYS_REQUIRED, CLINICAL_KEYS, FACT_LABELS } from "../ledger/keys";
import type { FactKey, FactLedger } from "../ledger/types";
import { appendEnclosuresBlock } from "../letter/enclosures";
import { findUnapprovedCitations } from "../validate/citations";
import { canExportLetter, validateLetter } from "../validate/index";
import { isFactLedger } from "../netlify-entry";

function fact(
  ledger: FactLedger,
  key: FactKey,
  value: string | string[],
  provenance: "document" | "user" | "derived" = "user"
): FactLedger {
  return setFact(
    ledger,
    key,
    value,
    provenance,
    provenance === "document" ? `doc:t:p1:${key}` : `wizard:step3:${key}`,
    provenance === "document" ? 0.9 : 1
  );
}

function fullRequiredLedger(): FactLedger {
  let L = emptyLedger(["fixture"]);
  const pairs: Array<[FactKey, string | string[]]> = [
    ["claim.number", "CLM-100"],
    ["claim.payerName", "Acme Health"],
    ["claim.payerAppealAddress", "P.O. Box 1, Austin, TX 78701"],
    ["claim.dateOfService", "2026-01-15"],
    ["claim.billedAmount", "1200.00"],
    ["claim.deniedAmount", "1200.00"],
    ["claim.carcCodes", ["50"]],
    ["claim.cptCodes", ["99213"]],
    ["patient.name", "Jane Doe"],
    ["patient.memberId", "M123"],
    ["patient.planType", "fully-insured-group"],
    ["provider.name", "Axis Clinic"],
    ["provider.npi", "1234567890"],
    ["provider.addressBlock", "1 Main St, Austin, TX 78701"],
    ["provider.phone", "512-555-0100"],
    ["signer.name", "Pat Billing"],
    ["signer.title", "Billing Manager"],
  ];
  for (const [k, v] of pairs) L = fact(L, k, v);
  return L;
}

describe("phase1 keys completeness", () => {
  it("FACT_LABELS covers every FactKey used in ALWAYS_REQUIRED and CLINICAL_KEYS", () => {
    for (const k of [...ALWAYS_REQUIRED, ...CLINICAL_KEYS]) {
      assert.ok(FACT_LABELS[k], `missing label for ${k}`);
    }
  });
});

describe("phase1 builder", () => {
  it("missingRequired lists gaps on empty ledger", () => {
    const missing = missingRequired(emptyLedger());
    assert.equal(missing.length, ALWAYS_REQUIRED.length);
  });

  it("fullRequiredLedger has no missing required facts", () => {
    assert.deepEqual(missingRequired(fullRequiredLedger()), []);
  });

  it("isFactLedger accepts emptyLedger", () => {
    assert.equal(isFactLedger(emptyLedger()), true);
    assert.equal(isFactLedger({}), false);
  });
});

describe("phase1 adapter confidence", () => {
  it("maps Fact.confidence >= 0.5 to high for Step 2 borders", () => {
    let L = emptyLedger(["d"]);
    L = setFact(L, "patient.name", "Jane Doe", "document", "doc:d:p1:patient_name", 0.95);
    L = setFact(L, "claim.payerName", "Acme", "document", "doc:d:p1:payer_name", 0.2);
    const legacy = ledgerToLegacyShape(L);
    assert.equal(legacy.patientNameConfidence, "high");
    assert.equal(legacy.payerNameConfidence, "low");
  });
});

describe("phase1 enclosures", () => {
  it("omits Enclosures block when none checked", () => {
    const out = appendEnclosuresBlock("Body.", [
      { id: "eob_copy", label: "Copy of the EOB / remittance advice", checked: false },
    ]);
    assert.equal(out, "Body.");
    assert.equal(/Enclosures:/i.test(out), false);
  });

  it("appends only checked enclosures", () => {
    const out = appendEnclosuresBlock("Body.", [
      { id: "eob_copy", label: "Copy of the EOB / remittance advice", checked: true },
      { id: "lmn", label: "Letter of medical necessity", checked: false },
      { id: "imaging", label: "Imaging reports", checked: true },
    ]);
    assert.match(out, /Enclosures:\n- Copy of the EOB/);
    assert.match(out, /- Imaging reports/);
    assert.equal(/Letter of medical necessity/.test(out), false);
  });
});

describe("phase1 citations", () => {
  it("flags NCD/ERISA/U.S.C. when allowlist is empty", () => {
    const hits = findUnapprovedCitations(
      "See NCD 100.1 and 29 U.S.C. 1133 under ERISA."
    );
    assert.ok(hits.some((h) => /NCD/i.test(h)));
    assert.ok(hits.some((h) => /U\.S\.C\./i.test(h)));
    assert.ok(hits.some((h) => /ERISA/i.test(h)));
  });

  it("returns no hits for plain billing prose", () => {
    assert.deepEqual(
      findUnapprovedCitations(
        "The claim was denied under CARC 50. We request reconsideration of payment."
      ),
      []
    );
  });
});

describe("phase1 validateLetter + export gate", () => {
  it("fails on unresolved placeholders", () => {
    const L = fullRequiredLedger();
    const errors = validateLetter(
      "Patient [[REQUIRED: patient.memberId — Member ID]] appeals.",
      L
    );
    assert.ok(errors.some((e) => e.rule === "no_unresolved_placeholders"));
    assert.equal(canExportLetter("Patient [[REQUIRED: x — y]]", L).ok, false);
  });

  it("fails on missing required facts", () => {
    const errors = validateLetter("Short letter.", emptyLedger());
    assert.ok(errors.some((e) => e.rule === "no_missing_required_facts"));
  });

  it("fails on unapproved citations", () => {
    const L = fullRequiredLedger();
    const errors = validateLetter("Denial conflicts with LCD L123.", L);
    assert.ok(errors.some((e) => e.rule === "no_unapproved_citations"));
  });

  it("fails on enclosure references in body but not Enclosures block", () => {
    const L = fullRequiredLedger();
    const body =
      "Enclosed herewith is the operative report.\n\nEnclosures:\n- Operative report";
    const errors = validateLetter(body, L);
    assert.ok(errors.some((e) => e.rule === "no_enclosure_reference_in_body"));
  });

  it("allows clean letter with trailing Enclosures block", () => {
    const L = fullRequiredLedger();
    L.enclosures = [
      { id: "eob_copy", label: "Copy of the EOB / remittance advice", checked: true },
    ];
    const text = appendEnclosuresBlock(
      [
        "Axis Clinic",
        "1 Main St, Austin, TX 78701",
        "Phone: 512-555-0100",
        "NPI: 1234567890",
        "",
        "January 15, 2026",
        "",
        "Acme Health",
        "P.O. Box 1, Austin, TX 78701",
        "",
        "Re: Formal Appeal — Claim CLM-100",
        "    Patient: Jane Doe | Member ID: M123",
        "    DOS: January 15, 2026",
        "    CPT: 99213 | Billed: $1,200.00",
        "    Denied: $1,200.00",
        "    Denial Codes: CARC CO-50",
        "",
        "To the Appeals Review Department:",
        "We appeal claim CLM-100 for Jane Doe denied under CARC CO-50 for CPT 99213.",
        "",
        "Sincerely,",
        "Pat Billing",
        "Billing Manager",
      ].join("\n"),
      L.enclosures
    );
    const errors = validateLetter(text, L);
    assert.deepEqual(
      errors,
      [],
      errors.map((e) => `${e.rule}: ${e.message}`).join("; ")
    );
    assert.equal(getValue(L, "claim.number"), "CLM-100");
  });

  it("no_internal_grounding_language + all_required_facts_rendered", () => {
    const L = fullRequiredLedger();
    const leaked =
      "No clinical narrative is offered beyond the procedure code as billed.";
    assert.ok(
      validateLetter(leaked, L).some(
        (e) => e.rule === "no_internal_grounding_language"
      )
    );
    const incomplete =
      "We appeal CLM-100 for Jane Doe M123 on January 15, 2026 CPT 99213 $1,200.00 CARC CO-50 Axis Clinic NPI 1234567890 Phone 512-555-0100. Sincerely,\nPat Billing\nBilling Manager";
    assert.ok(
      validateLetter(incomplete, L).some(
        (e) => e.rule === "all_required_facts_rendered"
      )
    );
  });
});

