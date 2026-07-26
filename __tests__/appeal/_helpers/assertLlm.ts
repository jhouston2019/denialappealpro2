import type { GenerationResult } from "../../../lib/appeal/generate/types";

export function assertLlmPath(result: GenerationResult): void {
  if (result.generatorPath !== "llm") {
    throw new Error(
      "GROUNDING TEST INVALID: ran against deterministic draft. " +
        "These tests only mean something against the LLM. Set OPENAI_API_KEY."
    );
  }
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const code = (err as { code?: string }).code;
    const status = (err as { status?: number }).status;
    return code === "rate_limit_exceeded" || status === 429;
  }
  return false;
}

async function generateWithRetry(
  generate: () => Promise<GenerationResult>,
  attempt = 1
): Promise<GenerationResult> {
  let delayMs = 500;
  for (let tries = 0; tries < 6; tries++) {
    try {
      return await generate();
    } catch (err) {
      if (!isRateLimitError(err) || tries === 5) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  }
  throw new Error(`generate failed after retries (attempt ${attempt})`);
}

export { generateWithRetry as generateLlmWithRetry };

/** Run an LLM grounding assertion three times; all must pass. */
export async function assertLlmThrice(
  generate: () => Promise<GenerationResult>,
  assertOne: (result: GenerationResult, attempt: number) => void | Promise<void>
): Promise<void> {
  for (let i = 1; i <= 3; i++) {
    const result = await generateWithRetry(generate, i);
    assertLlmPath(result);
    // Surface path in TAP diagnostics
    console.log(`# generatorPath: '${result.generatorPath}' (attempt ${i}/3)`);
    await assertOne(result, i);
  }
}
