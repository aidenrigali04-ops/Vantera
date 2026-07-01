import { describe, expect, it } from "vitest";
import { strategyDirectives } from "./shared";

describe("strategyDirectives", () => {
  it("returns empty for no strategy — champion baseline is byte-identical to before the optimizer", () => {
    expect(strategyDirectives()).toBe("");
    expect(strategyDirectives({})).toBe("");
    // a no-op knob value produces no directive
    expect(strategyDirectives({ followupLength: "standard" })).toBe("");
  });

  it("renders one directive per set knob, appended (never overriding) the base rules", () => {
    const d = strategyDirectives({ followupLength: "tight", askStyle: "specific" });
    expect(d).toContain("apply in addition to");
    expect(d).toContain("single, ruthlessly tight");
    expect(d).toContain("concrete next step");
    // two knobs → two directive lines
    expect(d.split("\n- ").length).toBe(3); // header + 2 lines
  });
});
