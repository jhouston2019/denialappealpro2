/**
 * Emit Cigna golden letters (a) and (b).
 * Requires OPENAI_API_KEY (loads .env.test). Fails closed otherwise.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateAppealLetter,
  validateLetter,
} from "../lib/appeal/netlify-entry.ts";
import {
  cignaLetterALedger,
  cignaLetterBLedger,
} from "../lib/appeal/__fixtures__/cigna.ts";

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
loadEnvFile(join(root, ".env.test"));
loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

const outDir = join(root, "lib", "appeal", "__fixtures__");

async function draft(ledger, label) {
  const result = await generateAppealLetter(ledger, {
    allowDeterministicFallback: false,
    model: "gpt-4o",
  });
  const errors = validateLetter(result.text, ledger);
  console.error(
    `[golden ${label}] generatorPath=${result.generatorPath} errors=${errors.length}`
  );
  for (const e of errors) console.error(`  - ${e.rule}: ${e.message}`);
  return result;
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error(
      "OPENAI_API_KEY required for golden letters. Copy .env.test.example → .env.test"
    );
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  console.log(
    "=== LETTER (a) — placeholder demo (omit npi/signer/group#; no clinical; no enclosures) ==="
  );
  const a = await draft(cignaLetterALedger(), "a");
  writeFileSync(join(outDir, "letter-a.txt"), a.text, "utf8");
  console.log(a.text);
  console.log("");
  console.log(
    "=== LETTER (b) — fully populated (5 clinical.* + 3 enclosures) ==="
  );
  const b = await draft(cignaLetterBLedger(), "b");
  writeFileSync(join(outDir, "letter-b.txt"), b.text, "utf8");
  console.log(b.text);

  const stripEnc = (t) =>
    t.replace(/\n\s*Enclosures:\s*\n[\s\S]*$/i, "").trim();
  if (stripEnc(a.text) === stripEnc(b.text)) {
    console.error("FAIL: letter (a) and (b) bodies are byte-identical outside enclosures");
    process.exit(1);
  }
  if (b.text.length <= a.text.length + 80) {
    console.error(
      `FAIL: letter (b) not materially longer (a=${a.text.length}, b=${b.text.length})`
    );
    process.exit(1);
  }
  console.error(
    `[golden] bodies differ; lengths a=${a.text.length} b=${b.text.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
