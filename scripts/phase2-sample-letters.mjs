/**
 * Emit Phase 2 sample letters for CO-15 branches A and D.
 * Requires OPENAI_API_KEY (.env.test).
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

function authLedger(branch, clinical = false, authNumber = null) {
  let L = cignaFullRequiredLedger();
  L = setFact(L, "claim.carcCodes", ["CO-15"], "document", "doc:sample:carc", 0.9);
  L = setFact(L, "appeal.authBranch", branch, "user", "wizard:step3:authBranch", 1);
  if (authNumber) {
    L = setFact(
      L,
      "claim.authorizationNumber",
      authNumber,
      "user",
      "wizard:step3:authorizationNumber",
      1
    );
  }
  if (clinical) {
    for (const [k, v] of CLINICAL_ALL) {
      L = setFact(L, k, v, "user", `wizard:step3:${k}`, 1);
    }
  }
  return L;
}

async function draft(label, ledger) {
  const result = await generateAppealLetter(ledger, {
    allowDeterministicFallback: false,
    model: "gpt-4o",
  });
  console.log(`\n=== ${label} (generatorPath=${result.generatorPath}) ===\n`);
  console.log(result.text);
  return result;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY required");
    process.exit(1);
  }
  await draft("CO-15 Branch D — no clinical facts", authLedger("D", false));
  await draft("CO-15 Branch D — all five clinical facts", authLedger("D", true));
  await draft(
    "CO-15 Branch A — auth on file",
    authLedger("A", false, "PA-8844221")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
