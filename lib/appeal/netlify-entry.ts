/**
 * Single entry surface for Netlify functions (esbuild-bundled).
 * Canonical implementations live under lib/appeal/* — do not duplicate in netlify/functions.
 */

export {
  emptyLedger,
  setFact,
  getFact,
  getValue,
  mergeLedger,
  missingRequired,
} from "./ledger/builder";
export { isFactLedger } from "./ledger/guard";
export { CLINICAL_KEYS, ALWAYS_REQUIRED, FACT_LABELS } from "./ledger/keys";
export { buildLedgerFromExtraction } from "./ledger/fromExtraction";
export { serializeLedgerForPrompt } from "./ledger/serialize";
export {
  GROUNDING_SYSTEM_PROMPT,
  buildGenerationUserMessage,
} from "./prompts/generation";
export { appendEnclosuresBlock } from "./letter/enclosures";
export {
  assembleSignatureBlock,
  isDateShapedString,
  stripTrailingSignature,
} from "./letter/signature";
export { finalizeLetter } from "./letter/finalize";
export {
  assembleLetter,
  assembleLetterParts,
  buildScaffold,
  buildAuthorities,
  buildProcedural,
  buildEscalation,
  buildSignature,
  extractNarrativeBody,
  normalizeAuthorityText,
  narrativeSectionSpec,
} from "./letter/assembler";
export { renderLetterScaffold, extractAppealBody } from "./letter/scaffold";
export {
  validateLetter,
  canExportLetter,
  CLINICAL_ASSERTION_RE,
} from "./validate/index";
export { evaluateExportGate, exportBlockedPayload } from "./export/gate";
export { deterministicGroundedDraft } from "./generate/deterministicDraft";
export { generateAppealLetter } from "./generate/generateAppeal";
export type { GeneratorPath, GenerationResult } from "./generate/types";
export {
  formatCurrency,
  formatLetterDate,
  formatCarc,
  formatRarc,
  formatNpi,
} from "./format/render";
export {
  routeDenial,
  serializeStrategyForPrompt,
  lookupCarc,
  normalizeCarcCode,
} from "./router/index";
export {
  getAuthorities,
  getAuthoritiesForLedger,
  normalizePayerSlug,
  serializeAuthoritiesForPrompt,
} from "./authorities/gate";
export { ALLOWED_CITATION_STRINGS } from "./authorities/allowlist";
export type { PlanType } from "./ledger/types";
export type {
  StrategyId,
  DenialStrategy,
  StrategyBranch,
  RouteDenialResult,
} from "./router/index";
export type { AuthorityRecord } from "./authorities/gate";
