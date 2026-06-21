import { describe, expect, it } from "vitest";
import { SEQUENCE_DEFAULTS, resolveSequenceConfig } from "./sequence-config";

describe("resolveSequenceConfig", () => {
  it("returns the defaults when config is null", () => {
    expect(resolveSequenceConfig(null)).toEqual(SEQUENCE_DEFAULTS);
  });

  it("defaults order to LinkedIn only", () => {
    expect(SEQUENCE_DEFAULTS.order).toEqual(["linkedin"]);
  });

  it("merges partial stage overrides over defaults", () => {
    const cfg = resolveSequenceConfig({ stages: { linkedin: { touches: 5 } } });
    expect(cfg.stages.linkedin.touches).toBe(5);
    expect(cfg.stages.linkedin.waitDays).toBe(SEQUENCE_DEFAULTS.stages.linkedin.waitDays);
  });

  it("keeps a custom order when supplied", () => {
    const cfg = resolveSequenceConfig({ order: ["linkedin"] });
    expect(cfg.order).toEqual(["linkedin"]);
  });
});
