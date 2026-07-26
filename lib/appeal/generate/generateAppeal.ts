import OpenAI from "openai";
import {
  GROUNDING_SYSTEM_PROMPT,
  buildGenerationUserMessage,
} from "../prompts/generation";
import type { FactLedger } from "../ledger/types";
import { finalizeLetter } from "../letter/finalize";
import { deterministicGroundedDraft } from "./deterministicDraft";
import type { GenerationResult } from "./types";

export type { GeneratorPath, GenerationResult } from "./types";

export interface GenerateAppealOptions {
  forceDeterministic?: boolean;
  allowDeterministicFallback?: boolean;
  model?: string;
}

export async function generateAppealLetter(
  ledger: FactLedger,
  opts: GenerateAppealOptions = {}
): Promise<GenerationResult> {
  if (opts.forceDeterministic) {
    return deterministicGroundedDraft(ledger);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (opts.allowDeterministicFallback) {
      return deterministicGroundedDraft(ledger);
    }
    throw new Error(
      "OPENAI_API_KEY is not set — cannot generate via LLM. Set it in .env.test."
    );
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: opts.model || "gpt-4o",
    temperature: 0.2,
    max_tokens: 4000,
    messages: [
      { role: "system", content: GROUNDING_SYSTEM_PROMPT },
      { role: "user", content: buildGenerationUserMessage(ledger) },
    ],
  });

  const modelBody = String(
    completion.choices[0]?.message?.content || ""
  ).trim();
  if (!modelBody) {
    throw new Error("Empty letter response from OpenAI");
  }

  return {
    text: finalizeLetter(modelBody, ledger),
    generatorPath: "llm",
    ledger,
  };
}
