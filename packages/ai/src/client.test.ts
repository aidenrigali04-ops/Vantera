import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getClassifierModel, getModel, getModelId, getPublicModel, toGatewayModelId } from "./client";

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

describe("getModelId", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns the same default the model factory uses, without needing an API key", () => {
    expect(getModelId()).toBe("claude-sonnet-4-6");
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getModelId()).toBe(getModel().modelId);
  });

  it("respects ANTHROPIC_MODEL", () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    expect(getModelId()).toBe("claude-opus-4-8");
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(getModelId()).toBe(getModel().modelId);
  });
});

describe("toGatewayModelId", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.TOOLS_AI_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("defaults to the current Haiku alias on the AI Gateway", () => {
    expect(toGatewayModelId()).toBe("anthropic/claude-haiku-4.5");
  });

  it("normalizes the dated Anthropic snapshot id used by the old tools route", () => {
    expect(toGatewayModelId("claude-haiku-4-5-20251001")).toBe("anthropic/claude-haiku-4.5");
  });

  it("passes through an already-prefixed gateway id", () => {
    expect(toGatewayModelId("anthropic/claude-haiku-4.5")).toBe("anthropic/claude-haiku-4.5");
  });

  it("respects TOOLS_AI_MODEL, including a native Anthropic id", () => {
    process.env.TOOLS_AI_MODEL = "claude-haiku-4-5";
    expect(toGatewayModelId()).toBe("anthropic/claude-haiku-4.5");
  });
});

describe("getPublicModel", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.TOOLS_AI_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns a gateway model id without requiring ANTHROPIC_API_KEY", () => {
    expect(getPublicModel()).toBe("anthropic/claude-haiku-4.5");
  });
});

describe("getClassifierModel", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_CLASSIFIER_MODEL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses Haiku and ignores ANTHROPIC_MODEL", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-opus-4-8";
    expect(getClassifierModel().modelId).toBe("claude-haiku-4-5-20251001");
    expect(getModel().modelId).toBe("claude-opus-4-8");
  });

  it("honors ANTHROPIC_CLASSIFIER_MODEL only", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_CLASSIFIER_MODEL = "claude-haiku-4-5";
    expect(getClassifierModel().modelId).toBe("claude-haiku-4-5");
  });
});
