import { describe, expect, it } from "vitest";
import {
  proposeChallengerStrategy,
  proposeNextChallenger,
  nextExperimentStage,
  describeStrategy,
  isTerminalStatus,
} from "./experiment";
import type { CopyStrategy } from "../copy/shared";

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

describe("proposeNextChallenger", () => {
  it("flips the stage knob away from the champion's current value", () => {
    expect(proposeNextChallenger("acceptance", { openWith: "trigger" })).toEqual({ openWith: "pain" });
    expect(proposeNextChallenger("acceptance", { openWith: "pain" })).toEqual({ openWith: "trigger" });
    expect(proposeNextChallenger("reply", { followupLength: "tight" })).toEqual({ followupLength: "standard" });
    expect(proposeNextChallenger("reply", { followupLength: "standard" })).toEqual({ followupLength: "tight" });
    expect(proposeNextChallenger("booking", { askStyle: "specific" })).toEqual({ askStyle: "soft" });
    expect(proposeNextChallenger("booking", { askStyle: "soft" })).toEqual({ askStyle: "specific" });
  });

  it("defaults to the classic proposal when the champion has no setting on the knob", () => {
    expect(proposeNextChallenger("acceptance", {})).toEqual(proposeChallengerStrategy("acceptance"));
    expect(proposeNextChallenger("reply", {})).toEqual(proposeChallengerStrategy("reply"));
    expect(proposeNextChallenger("booking", {})).toEqual(proposeChallengerStrategy("booking"));
  });

  it("returns null for close (not a copy lever)", () => {
    expect(proposeNextChallenger("close", {})).toBeNull();
  });

  it("never proposes a challenger equal to the champion on the tested knob", () => {
    const champions: CopyStrategy[] = [
      {},
      { openWith: "trigger" },
      { openWith: "pain" },
      { followupLength: "tight" },
      { followupLength: "standard" },
      { askStyle: "soft" },
      { askStyle: "specific" },
      { openWith: "pain", followupLength: "tight", askStyle: "soft" },
    ];
    for (const stage of ["acceptance", "reply", "booking"] as const) {
      for (const champ of champions) {
        const c = proposeNextChallenger(stage, champ)!;
        const knob = Object.keys(c)[0] as keyof CopyStrategy;
        expect(Object.values(c).filter(Boolean).length).toBe(1);
        expect(c[knob]).toBeDefined();
        expect(c[knob]).not.toEqual(champ[knob]);
      }
    }
  });
});

describe("nextExperimentStage", () => {
  it("rotates acceptance → reply → booking → acceptance", () => {
    expect(nextExperimentStage("acceptance")).toBe("reply");
    expect(nextExperimentStage("reply")).toBe("booking");
    expect(nextExperimentStage("booking")).toBe("acceptance");
    expect(nextExperimentStage("close")).toBe("acceptance");
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
