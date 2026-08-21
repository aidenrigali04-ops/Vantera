import { createAnthropic } from "@ai-sdk/anthropic";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Single source of truth for which model id resolves for a call: an explicit override,
 * else the `ANTHROPIC_MODEL` env var, else the locked default. `getModel()` and `getModelId()`
 * both call this — extracted so the two can never drift apart (SendRecipe v2 stamps whatever
 * `getModelId()` returns as the drafting model, and that must be exactly what `getModel()` used).
 */
function resolveModelId(modelId?: string): string {
  return modelId ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

/**
 * The single Anthropic entry point (locked, rule 02). All product code gets
 * models from here — never construct a provider or import an AI SDK provider
 * package anywhere else.
 */
export function getModel(modelId?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const anthropic = createAnthropic({ apiKey });
  return anthropic(resolveModelId(modelId));
}

/**
 * The model id that `getModel()` (called with no override, as every brain does) resolves to —
 * for stamping SendRecipe.modelId at draft time. No API key required: this never talks to the
 * provider, it only resolves the id.
 */
export function getModelId(): string {
  return resolveModelId();
}
