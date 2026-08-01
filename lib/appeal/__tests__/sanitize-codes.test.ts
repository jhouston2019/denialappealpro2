import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCarcDescription } from "../format/sanitizeCodes";
import { lookupCarc } from "../router/carc-table";
import { formatLedgerDenialCodes } from "../format/render";
import { emptyLedger, setFact } from "../ledger/builder";

test("sanitizeCarcDescription strips 835 EDI remark suffix", () => {
  const polluted =
    "These are non-covered services because this is not deemed a 'medical necessity' by the payer. Usage: Refer to the 835 Healthcare Policy Identification Segment (loop 2110 Service Payment Information REF), if present.";
  const clean = sanitizeCarcDescription(polluted);
  assert.ok(!clean.includes("835"));
  assert.ok(!clean.includes("loop 2110"));
  assert.ok(!clean.includes("Usage:"));
  assert.ok(!clean.includes("if present"));
});

test("CARC 50 lookup uses clean medical necessity descriptor", () => {
  const entry = lookupCarc("50");
  assert.ok(entry);
  assert.equal(
    entry!.descriptor,
    "These are non-covered services because this is not deemed a medical necessity by the payer."
  );
  assert.ok(!entry!.descriptor.includes("835"));
  assert.ok(!entry!.descriptor.includes("loop 2110"));
});

test("formatLedgerDenialCodes uses clean CARC descriptor in letter header", () => {
  let ledger = emptyLedger();
  ledger = setFact(ledger, "claim.carcCodes", ["50"], "user", "test", 1);
  const line = formatLedgerDenialCodes(ledger);
  assert.match(line, /CARC CO-50/);
  assert.ok(!line.includes("835"));
  assert.ok(!line.includes("loop 2110"));
  assert.match(
    line,
    /medical necessity by the payer/
  );
});
