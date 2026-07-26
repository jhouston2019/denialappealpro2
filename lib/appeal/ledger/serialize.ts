import { FACT_LABELS } from "./keys";
import type { FactKey, FactLedger, FactValue } from "./types";

function formatValue(value: FactValue): string {
  if (value == null) return "null";
  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value) : "null";
  }
  return String(value);
}

/** Readable key/value block for the generation user message. */
export function serializeLedgerForPrompt(ledger: FactLedger): string {
  const keys = Object.keys(FACT_LABELS) as FactKey[];
  const lines: string[] = [
    "FACT LEDGER (ledgerVersion=1)",
    `createdAt: ${ledger.meta.createdAt}`,
    `documentIds: ${JSON.stringify(ledger.meta.documentIds)}`,
    "",
    "FACTS:",
  ];

  for (const key of keys) {
    const fact = ledger.facts[key];
    if (!fact) {
      lines.push(
        `- ${key} (${FACT_LABELS[key]}): null | provenance=absent | confidence=0 | sourceRef=absent`
      );
      continue;
    }
    lines.push(
      `- ${key} (${FACT_LABELS[key]}): ${formatValue(fact.value)} | provenance=${fact.provenance} | confidence=${fact.confidence} | sourceRef=${fact.sourceRef}`
    );
  }

  const checked = (ledger.enclosures || []).filter((e) => e.checked);
  lines.push("");
  lines.push("ENCLOSURES (system-rendered after letter body — do not mention in body):");
  if (!checked.length) {
    lines.push("- (none checked)");
  } else {
    for (const e of checked) {
      lines.push(`- ${e.id}: ${e.label}`);
    }
  }

  return lines.join("\n");
}
