/**
 * Generate appeal letter from the UHC wizard snapshot (post-checkout simulation).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateAppealLetter } from "../lib/appeal/netlify-entry.ts";
import { ensureLedgerWithStrategyBranches } from "../lib/appeal/router/resolveStrategyBranches.ts";
import { DEFAULT_ENCLOSURES } from "../lib/appeal/ledger/keys.ts";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const root = resolve(process.cwd());
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env.test"));

const snap = JSON.parse(
  readFileSync(resolve(root, "scripts/.last-wizard-snapshot.json"), "utf8")
);

const enclosures = snap.ledger?.enclosures?.length
  ? snap.ledger.enclosures
  : DEFAULT_ENCLOSURES.map((e) => ({ id: e.id, label: e.label, checked: false }));

const ledger = ensureLedgerWithStrategyBranches(
  snap.ledger,
  snap.intake,
  enclosures
);

const result = await generateAppealLetter(ledger, {
  allowDeterministicFallback: false,
  model: "gpt-4o",
});

console.log(`generatorPath=${result.generatorPath}`);
console.log("\n--- APPEAL LETTER ---\n");
console.log(result.text);
