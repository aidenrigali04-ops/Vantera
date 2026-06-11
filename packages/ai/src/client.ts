import { createAnthropic } from "@ai-sdk/anthropic";

const DEFAULT_MODEL = "claude-sonnet-4-6";

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
  return anthropic(modelId ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL);
}
