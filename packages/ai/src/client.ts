import { createAnthropic } from "@ai-sdk/anthropic";

const DEFAULT_MODEL = "claude-sonnet-4-6";
/** Rank, intent, and reply classification. Not the draft model. Does not follow ANTHROPIC_MODEL. */
export const CLASSIFIER_MODEL_ID = "claude-haiku-4-5-20251001";
/** Cheap model for unauthenticated public tools — billed through Vercel AI Gateway, not Anthropic console credits. */
export const DEFAULT_PUBLIC_MODEL = "anthropic/claude-haiku-4.5";

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

export function getClassifierModel() {
  const id = process.env.ANTHROPIC_CLASSIFIER_MODEL?.trim() || CLASSIFIER_MODEL_ID;
  return getModel(id);
}

/**
 * Map a model pin to a Vercel AI Gateway id (`provider/model`). Native Anthropic snapshot
 * ids from older env pins (e.g. `claude-haiku-4-5-20251001`) collapse onto the current
 * Haiku 4.5 gateway alias so public tools keep working when Anthropic retires a date stamp.
 */
export function toGatewayModelId(modelId?: string): string {
  const raw = (modelId ?? process.env.TOOLS_AI_MODEL ?? DEFAULT_PUBLIC_MODEL).trim();
  if (!raw) return DEFAULT_PUBLIC_MODEL;
  if (raw.includes("/")) return raw;
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("claude-haiku-4-5") || normalized.startsWith("claude-haiku-4.5")) {
    return DEFAULT_PUBLIC_MODEL;
  }
  return `anthropic/${raw}`;
}

/**
 * Model for public, unauthenticated generators (landing-page LinkedIn tools).
 *
 * Returns a gateway model id string — AI SDK 6 routes those through the Vercel AI Gateway
 * (OIDC on Vercel, or `AI_GATEWAY_API_KEY` locally). This is intentionally NOT `getModel()`:
 * product brains on Trigger.dev bill Anthropic console credits; a depleted balance there
 * must not take down the free tools.
 */
export function getPublicModel(modelId?: string) {
  return toGatewayModelId(modelId);
}
