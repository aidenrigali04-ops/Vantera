import { describe, expect, it } from "vitest";
import { advanceSequence } from "./sequence-advance";
import { SEQUENCE_DEFAULTS } from "./sequence-config";
import type { LeadChannels, SequenceRun, SequenceTickContext } from "./types";

const NOW = new Date("2026-06-14T12:00:00Z");
const DAY = 86_400_000;

const fullChannels: LeadChannels = {
  linkedinUrl: "https://linkedin.com/in/x",
};

function ctx(run: Partial<SequenceRun>, over: Partial<SequenceTickContext> = {}): SequenceTickContext {
  return {
    run: {
      id: "r1", accountId: "a1", campaignId: "c1", leadId: "l1",
      status: "active", currentStage: "linkedin", touchesDone: 0,
      nextActionAt: NOW, enteredStageAt: NOW, ...run,
    },
    config: SEQUENCE_DEFAULTS,
    channels: fullChannels,
    suppressed: { linkedin: false },
    accountPaused: false,
    killSwitch: false,
    now: NOW,
    ...over,
  };
}

describe("advanceSequence", () => {
  it("dispatches the first LinkedIn touch and schedules the next by touch gap", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }));
    expect(d).toMatchObject({ kind: "dispatch", stage: "linkedin", touchNo: 1 });
    expect(d.kind === "dispatch" && d.patch.touchesDone).toBe(1);
    expect(d.kind === "dispatch" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + 2 * DAY);
  });

  it("on the last touch of the stage, schedules the conversion wait window", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 1 })); // target 2
    expect(d).toMatchObject({ kind: "dispatch", stage: "linkedin", touchNo: 2 });
    expect(d.kind === "dispatch" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + 3 * DAY);
  });

  it("exhausts after the wait window when no further stage remains", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }));
    expect(d).toMatchObject({ kind: "exhaust" });
    expect(d.kind === "exhaust" && d.patch.status).toBe("exhausted");
    expect(d.kind === "exhaust" && d.patch.currentStage).toBe("done");
  });

  it("exhausts immediately when the current stage is suppressed and nothing else is usable", () => {
    const d = advanceSequence(
      ctx({ currentStage: "linkedin", touchesDone: 0 }, { suppressed: { linkedin: true } })
    );
    expect(d).toMatchObject({ kind: "exhaust" });
  });

  it("holds when the global kill switch is on", () => {
    expect(advanceSequence(ctx({}, { killSwitch: true }))).toEqual({ kind: "hold" });
  });

  it("holds when the account is paused", () => {
    expect(advanceSequence(ctx({}, { accountPaused: true }))).toEqual({ kind: "hold" });
  });

  it("exhausts when the lead has no LinkedIn identifier", () => {
    const channels = { linkedinUrl: null };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }, { channels }));
    expect(d).toMatchObject({ kind: "exhaust" });
  });
});
