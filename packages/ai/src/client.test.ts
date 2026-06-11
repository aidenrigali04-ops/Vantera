import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getModel } from "./client";

describe("getModel", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("throws a clear error when ANTHROPIC_API_KEY is missing", () => {
    expect(() => getModel()).toThrowError(/ANTHROPIC_API_KEY/);
  });

  it("returns a model bound to the default model id", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getModel().modelId).toBe("claude-sonnet-4-6");
  });

  it("respects ANTHROPIC_MODEL and explicit overrides", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    expect(getModel().modelId).toBe("claude-opus-4-8");
    expect(getModel("claude-haiku-4-5-20251001").modelId).toBe("claude-haiku-4-5-20251001");
  });
});
