import { describe, expect, it } from "vitest";
import { cacheSystemPrompt, costUsd, recordUsage, withUsage } from "./usage";

const usage = (o: { input?: number; noCache?: number; read?: number; write?: number; output?: number }) => ({
  inputTokens: { total: o.input, noCache: o.noCache, cacheRead: o.read, cacheWrite: o.write },
  outputTokens: { total: o.output, text: o.output, reasoning: undefined },
});

describe("costUsd", () => {
  it("prices uncached input, cache reads (0.1x), cache writes (1.25x), and output per model", () => {
    // Sonnet 4.6: $3 in / $15 out per MTok
    const c = costUsd("claude-sonnet-4-6", { noCache: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000, output: 1_000_000 });
    expect(c).toBeCloseTo(3 + 0.3 + 3.75 + 15, 6);
  });

  it("resolves dated snapshot ids to their family rate", () => {
    expect(costUsd("claude-haiku-4-5-20251001", { noCache: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 })).toBeCloseTo(1, 6);
  });

  it("returns null for a model with no known rate rather than guessing", () => {
    expect(costUsd("some-unknown-model", { noCache: 10, cacheRead: 0, cacheWrite: 0, output: 10 })).toBeNull();
  });
});

describe("withUsage", () => {
  it("totals every call recorded inside the scope, by model", async () => {
    const { result, usage: u } = await withUsage(async () => {
      recordUsage("claude-haiku-4-5-20251001", usage({ input: 1000, noCache: 1000, output: 200 }));
      recordUsage("claude-haiku-4-5-20251001", usage({ input: 1000, noCache: 1000, output: 200 }));
      recordUsage("claude-sonnet-4-6", usage({ input: 3000, noCache: 1000, read: 2000, output: 500 }));
      return "done";
    });
    expect(result).toBe("done");
    expect(u.calls).toBe(3);
    expect(u.inputTokens).toBe(5000);
    expect(u.cacheReadTokens).toBe(2000);
    expect(u.outputTokens).toBe(900);
    expect(u.byModel["claude-haiku-4-5-20251001"]?.calls).toBe(2);
    // haiku: 2000 in @ $1 + 400 out @ $5; sonnet: 1000 in @ $3 + 2000 read @ $0.3 + 500 out @ $15
    expect(u.costUsd).toBeCloseTo((2000 * 1 + 400 * 5 + 1000 * 3 + 2000 * 0.3 + 500 * 15) / 1e6, 9);
  });

  it("derives uncached input from total − cache when the provider omits noCache", async () => {
    const { usage: u } = await withUsage(async () => {
      recordUsage("claude-sonnet-4-6", usage({ input: 3000, read: 2000, write: 0, output: 0 }));
    });
    expect(u.costUsd).toBeCloseTo((1000 * 3 + 2000 * 0.3) / 1e6, 9);
  });

  it("isolates concurrent scopes and ignores calls made outside any scope", async () => {
    recordUsage("claude-sonnet-4-6", usage({ input: 999, noCache: 999, output: 999 })); // no scope: dropped
    const [a, b] = await Promise.all([
      withUsage(async () => {
        await new Promise((r) => setTimeout(r, 5));
        recordUsage("claude-sonnet-4-6", usage({ input: 10, noCache: 10, output: 1 }));
      }),
      withUsage(async () => {
        recordUsage("claude-sonnet-4-6", usage({ input: 20, noCache: 20, output: 2 }));
      }),
    ]);
    expect(a.usage.inputTokens).toBe(10);
    expect(b.usage.inputTokens).toBe(20);
  });

  it("counts a model with no known rate as unpriced instead of zero-cost", async () => {
    const { usage: u } = await withUsage(async () => {
      recordUsage("some-unknown-model", usage({ input: 10, noCache: 10, output: 10 }));
    });
    expect(u.unpricedCalls).toBe(1);
    expect(u.costUsd).toBe(0);
  });
});

describe("cacheSystemPrompt", () => {
  it("marks the last system message with an ephemeral cache breakpoint", () => {
    const prompt = [
      { role: "system" as const, content: "sys" },
      { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
    ];
    const out = cacheSystemPrompt(prompt);
    expect(out[0]).toMatchObject({ role: "system", providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } });
    expect(out[1]).toEqual(prompt[1]);
    expect(prompt[0]).not.toHaveProperty("providerOptions"); // input not mutated
  });

  it("keeps existing provider options on the system message", () => {
    const out = cacheSystemPrompt([
      { role: "system" as const, content: "sys", providerOptions: { anthropic: { foo: 1 } } },
    ]);
    expect(out[0]).toMatchObject({ providerOptions: { anthropic: { foo: 1, cacheControl: { type: "ephemeral" } } } });
  });

  it("is a no-op when there is no system message", () => {
    const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }];
    expect(cacheSystemPrompt(prompt)).toEqual(prompt);
  });
});

describe("withTelemetry (integration through generateText)", () => {
  it("records the call's usage in the active scope and sends the system prompt with a cache breakpoint", async () => {
    const { generateText } = await import("ai");
    const { MockLanguageModelV3 } = await import("ai/test");
    const { withTelemetry } = await import("./usage");
    const seen: unknown[] = [];
    const base = new MockLanguageModelV3({
      modelId: "claude-sonnet-4-6",
      doGenerate: async (options) => {
        seen.push(options.prompt);
        return {
          content: [{ type: "text", text: "ok" }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 1500, noCache: 500, cacheRead: 1000, cacheWrite: 0 },
            outputTokens: { total: 40, text: 40, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });

    const { usage: u } = await withUsage(() =>
      generateText({ model: withTelemetry(base), system: "be brief", prompt: "hi" })
    );

    expect(u.calls).toBe(1);
    expect(u.cacheReadTokens).toBe(1000);
    expect(u.costUsd).toBeCloseTo((500 * 3 + 1000 * 0.3 + 40 * 15) / 1e6, 9);
    const sys = (seen[0] as { role: string; providerOptions?: unknown }[])[0]!;
    expect(sys).toMatchObject({ role: "system", providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } });
  });
});
