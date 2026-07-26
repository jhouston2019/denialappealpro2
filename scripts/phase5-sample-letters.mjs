/**
 * Phase 5 sample letters — CO-50, CO-97, CO-29.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAppealLetter } from "../lib/appeal/netlify-entry.ts";
import {
  CLINICAL_ALL,
  cignaFullRequiredLedger,
} from "../lib/appeal/__fixtures__/cigna.ts";
import { setFact } from "../lib/appeal/ledger/builder.ts";
import { getRecordById } from "../lib/appeal/authorities/records.ts";
import { normalizeAuthorityText } from "../lib/appeal/letter/assembler.ts";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(root, ".env.test"));
loadEnvFile(resolve(root, ".env.local"));

function letter3() {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", ["50"], "document", "doc:sample:carc", 0.9);
  L = setFact(L, "patient.planType", "erisa-self-funded", "user", "wizard:step3:planType", 1);
  for (const [k, v] of CLINICAL_ALL) {
    L = setFact(L, k, v, "user", `wizard:step3:${k}`, 1);
  }
  return L;
}

function letter4() {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", ["97"], "document", "doc:sample:carc", 0.9);
  L = setFact(L, "patient.planType", "erisa-self-funded", "user", "wizard:step3:planType", 1);
  L = setFact(L, "appeal.bundlingBranch", "modifier-59", "user", "wizard:step3:bundlingBranch", 1);
  return L;
}

function letter5() {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", ["29"], "document", "doc:sample:carc", 0.9);
  L = setFact(L, "patient.planType", "fully-insured-group", "user", "wizard:step3:planType", 1);
  L = setFact(
    L,
    "appeal.timelyFilingBranch",
    "proof-of-timely-submission",
    "user",
    "wizard:step3:timelyFilingBranch",
    1
  );
  return L;
}

function verifyVerbatim(label, text, ids) {
  console.log(`\n--- Verbatim check: ${label} ---`);
  for (const id of ids) {
    const rec = getRecordById(id);
    if (!rec) continue;
    const ok = normalizeAuthorityText(text).includes(
      normalizeAuthorityText(rec.argument)
    );
    console.log(`  ${id}: ${ok ? "VERBATIM OK" : "MISSING/PARAPHRASED"}`);
  }
}

async function draft(label, L, verbatimIds = []) {
  const result = await generateAppealLetter(L, {
    allowDeterministicFallback: false,
    model: "gpt-4o",
  });
  console.log(`\n=== ${label} (generatorPath=${result.generatorPath}) ===\n`);
  console.log(result.text);
  if (verbatimIds.length) verifyVerbatim(label, result.text, verbatimIds);
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY required");
    process.exit(1);
  }
  await draft("Letter 3 — ERISA CO-50 medical necessity Cigna CPT 27130 all clinical", letter3(), [
    "cigna-coverage-policy-hip-arthroplasty",
    "aaos-guideline-hip-arthroplasty",
    "erisa-503-full-fair-review",
    "aca-external-review",
  ]);
  await draft("Letter 4 — ERISA CO-97 modifier-59 bundling", letter4(), [
    "ncci-policy-manual-medical-necessity",
    "cpt-guidelines-separate-procedure",
  ]);
  await draft("Letter 5 — Fully-insured CO-29 proof-of-timely-submission", letter5(), [
    "aca-external-review",
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
