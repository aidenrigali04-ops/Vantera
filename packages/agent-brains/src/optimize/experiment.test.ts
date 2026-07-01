import { describe, expect, it } from "vitest";
import { proposeChallengerStrategy, describeStrategy, isTerminalStatus } from "./experiment";

describe("proposeChallengerStrategy", () => {
  it("proposes exactly one copy knob per copy-controllable leak", () => {
    expect(proposeChallengerStrategy("acceptance")).toEqual({ openWith: "trigger" });
    expect(proposeChallengerStrategy("reply")).toEqual({ followupLength: "tight" });
    expect(proposeChallengerStrategy("booking")).toEqual({ askStyle: "specific" });
  });

  it("proposes nothing for the close stage (not a copy lever)", () => {
    expect(proposeChallengerStrategy("close")).toBeNull();
  });

  it("only ever changes one knob (single-variable experiments)", () => {
    for (const stage of ["acceptance", "reply", "booking"] as const) {
      const s = proposeChallengerStrategy(stage)!;
      expect(Object.values(s).filter(Boolean).length).toBe(1);
    }
  });
});

describe("describeStrategy", () => {
  it("labels a strategy in plain English", () => {
    expect(describeStrategy({ followupLength: "tight" })).toContain("tighter");
  });
  it("handles an empty strategy", () => {
    expect(describeStrategy({})).toBe("the current approach");
  });
});

describe("isTerminalStatus", () => {
  it("marks adopted/discarded/halted terminal and running/ready not", () => {
    expect(isTerminalStatus("adopted")).toBe(true);
    expect(isTerminalStatus("discarded")).toBe(true);
    expect(isTerminalStatus("halted")).toBe(true);
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("ready_to_adopt")).toBe(false);
  });
});
