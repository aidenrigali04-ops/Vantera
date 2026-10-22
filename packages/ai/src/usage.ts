import { AsyncLocalStorage } from "node:async_hooks";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";

/**
 * LLM token + cost telemetry and prompt caching for every model `getModel()` returns.
 *
 * A pipeline wraps its run in `withUsage(fn)`; every model call made inside (however deep in the
 * brains) lands in that run's accumulator via the middleware below — no brain signature changes.
 * Calls outside any scope are not recorded.
 */

type Rate = { input: number; output: number };

/** USD per million tokens. Cache reads bill at 0.1× input, cache writes (5-minute TTL) at 1.25×. */
const RATES: Record<string, Rate> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-8": { input: 5, output: 25 },
};
const CACHE_READ_MULT = 0.1;
const CACHE_WRITE_MULT = 1.25;

function rateFor(modelId: string): Rate | null {
  if (RATES[modelId]) return RATES[modelId];
  // dated snapshots (claude-haiku-4-5-20251001) share their family's rate
  const family = Object.keys(RATES).find((k) => modelId.startsWith(`${k}-`));
  return family ? RATES[family]! : null;
}

export type TokenSplit = { noCache: number; cacheRead: number; cacheWrite: number; output: number };

/** Dollar cost of one call's tokens; null when the model has no known rate. */
export function costUsd(modelId: string, t: TokenSplit): number | null {
  const r = rateFor(modelId);
  if (!r) return null;
  return (
    (t.noCache * r.input +
      t.cacheRead * r.input * CACHE_READ_MULT +
      t.cacheWrite * r.input * CACHE_WRITE_MULT +
      t.output * r.output) /
    1_000_000
  );
}

type ModelUsage = {
  calls: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type LlmUsage = ModelUsage & {
  /** calls on a model with no known rate — their cost is NOT in costUsd */
  unpricedCalls: number;
  byModel: Record<string, ModelUsage>;
};

const emptyModel = (): ModelUsage => ({
  calls: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  costUsd: 0,
});

const scope = new AsyncLocalStorage<LlmUsage>();

/** The provider-reported usage shape (LanguageModelV3Usage subset). */
type ProviderUsage = {
  inputTokens: { total?: number; noCache?: number; cacheRead?: number; cacheWrite?: number };
  outputTokens: { total?: number };
};

/** Add one call's usage to the active `withUsage` scope (no-op outside one). */
export function recordUsage(modelId: string, u: ProviderUsage): void {
  const acc = scope.getStore();
  if (!acc) return;
  const total = u.inputTokens.total ?? 0;
  const cacheRead = u.inputTokens.cacheRead ?? 0;
  const cacheWrite = u.inputTokens.cacheWrite ?? 0;
  const noCache = u.inputTokens.noCache ?? Math.max(0, total - cacheRead - cacheWrite);
  const output = u.outputTokens.total ?? 0;
  const cost = costUsd(modelId, { noCache, cacheRead, cacheWrite, output });

  const m = (acc.byModel[modelId] ??= emptyModel());
  for (const target of [acc, m]) {
    target.calls += 1;
    target.inputTokens += noCache + cacheRead + cacheWrite;
    target.cacheReadTokens += cacheRead;
    target.cacheWriteTokens += cacheWrite;
    target.outputTokens += output;
    target.costUsd += cost ?? 0;
  }
  if (cost === null) acc.unpricedCalls += 1;
}

/** Run `fn` and return its result plus the token/cost totals of every model call inside it. */
export async function withUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: LlmUsage }> {
  const acc: LlmUsage = { ...emptyModel(), unpricedCalls: 0, byModel: {} };
  const result = await scope.run(acc, fn);
  return { result, usage: acc };
}

type PromptMessage = { role: string; providerOptions?: Record<string, Record<string, unknown>> };

/**
 * Put an ephemeral cache breakpoint on the last system message. Below the model's minimum
 * cacheable prefix (Sonnet 4.6: 1024 tokens, Haiku 4.5: 4096) the marker is silently ignored at
 * no cost; above it, repeat calls within 5 minutes read the system prompt at 0.1× input price.
 */
export function cacheSystemPrompt<M extends PromptMessage>(prompt: M[]): M[] {
  let last = -1;
  prompt.forEach((m, i) => {
    if (m.role === "system") last = i;
  });
  if (last === -1) return prompt;
  return prompt.map((m, i) =>
    i === last
      ? {
          ...m,
          providerOptions: {
            ...m.providerOptions,
            anthropic: { ...m.providerOptions?.anthropic, cacheControl: { type: "ephemeral" } },
          },
        }
      : m
  );
}

/** Caches the system prompt and records usage for every generate/stream call. */
export const telemetryMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  transformParams: async ({ params }) => ({ ...params, prompt: cacheSystemPrompt(params.prompt) }),
  wrapGenerate: async ({ doGenerate, model }) => {
    const result = await doGenerate();
    recordUsage(model.modelId, result.usage);
    return result;
  },
  wrapStream: async ({ doStream, model }) => {
    const { stream, ...rest } = await doStream();
    return {
      ...rest,
      stream: stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (chunk.type === "finish") recordUsage(model.modelId, chunk.usage);
            controller.enqueue(chunk);
          },
        })
      ),
    };
  },
};

/** Wrap a model with caching + usage telemetry. `getModel()` applies this to every model it returns. */
export function withTelemetry<M extends Parameters<typeof wrapLanguageModel>[0]["model"]>(model: M) {
  return wrapLanguageModel({ model, middleware: telemetryMiddleware });
}
