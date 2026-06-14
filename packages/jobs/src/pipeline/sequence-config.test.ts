import { describe, expect, it } from "vitest";
import { SEQUENCE_DEFAULTS, resolveSequenceConfig } from "./sequence-config";

describe("resolveSequenceConfig", () => {
  it("returns the defaults when config is null", () => {
    expect(resolveSequenceConfig(null)).toEqual(SEQUENCE_DEFAULTS);
  });

  it("defaults order to LinkedIn -> Email -> iMessage -> Caller", () => {
    expect(SEQUENCE_DEFAULTS.order).toEqual(["linkedin", "email", "imessage", "call"]);
    expect(SEQUENCE_DEFAULTS.stages.call.maxAttempts).toBe(2);
  });

  it("merges partial stage overrides over defaults", () => {
    const cfg = resolveSequenceConfig({ stages: { email: { enabled: false } } });
    expect(cfg.stages.email.enabled).toBe(false);
    expect(cfg.stages.email.touches).toBe(SEQUENCE_DEFAULTS.stages.email.touches);
    expect(cfg.stages.linkedin).toEqual(SEQUENCE_DEFAULTS.stages.linkedin);
  });

  it("keeps a custom order when supplied", () => {
    const cfg = resolveSequenceConfig({ order: ["email", "linkedin", "imessage", "call"] });
    expect(cfg.order).toEqual(["email", "linkedin", "imessage", "call"]);
  });
});
