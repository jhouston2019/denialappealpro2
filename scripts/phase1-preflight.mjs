/**
 * Fail closed if OPENAI_API_KEY is missing — grounding tests must hit the LLM.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const root = resolve(process.cwd());
loadEnvFile(resolve(root, ".env.test"));
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error(`
PHASE 1.6 PREFLIGHT FAILED

OPENAI_API_KEY is not set. Grounding tests must run against gpt-4o, not the
deterministic template.

Fix:
  1. Copy .env.test.example → .env.test
  2. Set OPENAI_API_KEY=sk-...
  3. Re-run: npm run test:phase1

.env.test is gitignored.
`);
  process.exit(1);
}

console.log(
  `[phase1-preflight] OPENAI_API_KEY present (len=${key.length}); grounding tests will use generatorPath=llm`
);
