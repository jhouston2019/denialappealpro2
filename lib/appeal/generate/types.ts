import type { FactLedger } from "../ledger/types";

export type GeneratorPath = "llm" | "deterministic";

export interface GenerationResult {
  text: string;
  generatorPath: GeneratorPath;
  ledger: FactLedger;
}
