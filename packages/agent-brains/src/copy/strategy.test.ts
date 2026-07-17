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

  it("renders openerAngle as a style-only directive (Stage 1b)", () => {
    const d = strategyDirectives({ openerAngle: "their recent post as the doorway" });
    expect(d).toContain('Angle the opener around: "their recent post as the doorway"');
    expect(d).toContain("never add facts or numbers");
  });

  // ── touch-shape awareness (WS-3.1 fix): opener knobs are first-touch-only wording — rendered
  // mid-thread they contradict the conversation brain's own anti-restart rule.
  describe("conversation shape", () => {
    it("suppresses openWith and openerAngle but keeps askStyle and followupLength", () => {
      const d = strategyDirectives(
        {
          openWith: "trigger",
          openerAngle: "their recent post as the doorway",
          askStyle: "specific",
          followupLength: "tight",
        },
        "conversation"
      );
      expect(d).not.toContain("Open by naming");
      expect(d).not.toContain("Angle the opener around");
      expect(d).toContain("concrete next step");
      expect(d).toContain("single, ruthlessly tight");
    });

    it("returns empty when only opener knobs are set — the conversation prompt stays untouched", () => {
      expect(strategyDirectives({ openWith: "pain" }, "conversation")).toBe("");
      expect(strategyDirectives({ openerAngle: "any angle" }, "conversation")).toBe("");
      expect(strategyDirectives({ openWith: "trigger", openerAngle: "x" }, "conversation")).toBe("");
    });

    it("first_touch is the default and still renders everything (existing callers byte-identical)", () => {
      const full = { openWith: "trigger" as const, askStyle: "soft" as const };
      expect(strategyDirectives(full)).toBe(strategyDirectives(full, "first_touch"));
      expect(strategyDirectives(full)).toContain("Open by naming");
      expect(strategyDirectives(full)).toContain("soft, low-pressure interest check");
    });
  });
});
