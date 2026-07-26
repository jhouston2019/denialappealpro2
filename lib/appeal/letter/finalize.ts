import type { FactLedger } from "../ledger/types";
import { getAuthoritiesForLedger } from "../authorities/gate";
import { assembleLetter, extractNarrativeBody } from "./assembler";

/**
 * Post-model assembly: deterministic scaffold + narrative (LLM) + authorities +
 * procedural + escalation + signature + enclosures.
 */
export function finalizeLetter(
  modelBody: string,
  ledger: FactLedger
): string {
  const authorities = getAuthoritiesForLedger(ledger);
  return assembleLetter(ledger, modelBody, authorities);
}

export { extractNarrativeBody as extractAppealBody };
