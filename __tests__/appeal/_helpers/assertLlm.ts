import type { GenerationResult } from "../../../lib/appeal/generate/types";

export function assertLlmPath(result: GenerationResult): void {
  if (result.generatorPath !== "llm") {
    throw new Error(
      "GROUNDING TEST INVALID: ran against deterministic draft. " +
        "These tests only mean something against the LLM. Set OPENAI_API_KEY."
    );
  }
}

/** Real gpt-4o runs should not produce byte-identical output three times in a row. */
export function assertLlmNondeterminism(texts: string[]): void {
  if (texts.length < 3) {
    throw new Error(
      `GROUNDING TEST INVALID: expected 3 LLM outputs for nondeterminism check, got ${texts.length}`
    );
  }
  const unique = new Set(texts.map((t) => t.trim()));
  if (unique.size < 2) {
    throw new Error(
      "GROUNDING TEST INVALID: three consecutive LLM runs produced identical output. " +
        "Real gpt-4o calls should differ at least once across 3 runs — " +
        "check for deterministic fallback or a mocked generator."
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

function isInvalidApiKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  const message = String((err as { message?: string }).message || "").toLowerCase();
  return (
    status === 401 ||
    message.includes("invalid api key") ||
    message.includes("incorrect api key") ||
    message.includes("invalid_api_key")
  );
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
      if (isInvalidApiKeyError(err)) {
        throw new Error(
          `GROUNDING TEST INVALID: OpenAI rejected OPENAI_API_KEY (${(err as { message?: string }).message || "Invalid API key"}). ` +
            "Replace the placeholder in .env.test with a real key."
        );
      }
      if (!isRateLimitError(err) || tries === 5) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  }
  throw new Error(`generate failed after retries (attempt ${attempt})`);
}

export { generateWithRetry as generateLlmWithRetry };

/**
 * Run an LLM grounding assertion three times against gpt-4o.
 * Fails closed on deterministic path or byte-identical triple output.
 */
export async function assertLlmThrice(
  generate: () => Promise<GenerationResult>,
  assertOne: (result: GenerationResult, attempt: number) => void | Promise<void>
): Promise<void> {
  const texts: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const result = await generateWithRetry(generate, i);
    assertLlmPath(result);
    texts.push(result.text);
    console.log(`# generatorPath: '${result.generatorPath}' (attempt ${i}/3)`);
    await assertOne(result, i);
  }
  assertLlmNondeterminism(texts);
}
