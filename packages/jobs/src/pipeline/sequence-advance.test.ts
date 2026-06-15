import { describe, expect, it } from "vitest";
import { advanceSequence } from "./sequence-advance";
import { SEQUENCE_DEFAULTS } from "./sequence-config";
import type { LeadChannels, SequenceRun, SequenceTickContext } from "./types";

const NOW = new Date("2026-06-14T12:00:00Z");
const DAY = 86_400_000;

const fullChannels: LeadChannels = {
  linkedinUrl: "https://linkedin.com/in/x",
  email: "x@acme.com",
  emailStatus: "valid",
  phone: "+15555550100",
  phoneStatus: "valid",
};

function ctx(run: Partial<SequenceRun>, over: Partial<SequenceTickContext> = {}): SequenceTickContext {
  return {
    run: {
      id: "r1", accountId: "a1", campaignId: "c1", leadId: "l1",
      status: "active", currentStage: "linkedin", touchesDone: 0, callAttempts: 0,
      nextActionAt: NOW, enteredStageAt: NOW, ...run,
    },
    config: SEQUENCE_DEFAULTS,
    channels: fullChannels,
    suppressed: { linkedin: false, email: false, phone: false },
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

  it("on the last touch of a stage, schedules the conversion wait window", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 1 })); // target 2
    expect(d).toMatchObject({ kind: "dispatch", stage: "linkedin", touchNo: 2 });
    expect(d.kind === "dispatch" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + 3 * DAY);
  });

  it("after the wait window (touches exhausted) advances to the next stage", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }));
    expect(d).toMatchObject({ kind: "advance" });
    expect(d.kind === "advance" && d.patch.currentStage).toBe("email");
    expect(d.kind === "advance" && d.patch.touchesDone).toBe(0);
    expect(d.kind === "advance" && d.patch.nextActionAt?.getTime()).toBe(NOW.getTime());
  });

  it("skips a disabled stage when advancing", () => {
    const config = { ...SEQUENCE_DEFAULTS, stages: { ...SEQUENCE_DEFAULTS.stages, email: { ...SEQUENCE_DEFAULTS.stages.email, enabled: false } } };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { config }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("imessage");
  });

  it("skips a stage with no channel identifier", () => {
    const channels = { ...fullChannels, email: null };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { channels }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("imessage");
  });

  it("advances off the current stage immediately when it is suppressed", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }, { suppressed: { linkedin: true, email: false, phone: false } }));
    expect(d.kind === "advance" && d.patch.currentStage).toBe("email");
  });

  it("counts call attempts and dials within max attempts", () => {
    const d = advanceSequence(ctx({ currentStage: "call", touchesDone: 0, callAttempts: 0 }));
    expect(d).toMatchObject({ kind: "dispatch", stage: "call", touchNo: 1 });
    expect(d.kind === "dispatch" && d.patch.callAttempts).toBe(1);
  });

  it("exhausts (archives) after the caller's max attempts with no next stage", () => {
    const d = advanceSequence(ctx({ currentStage: "call", touchesDone: 2, callAttempts: 2 }));
    expect(d).toMatchObject({ kind: "exhaust" });
    expect(d.kind === "exhaust" && d.patch.status).toBe("exhausted");
    expect(d.kind === "exhaust" && d.patch.currentStage).toBe("done");
  });

  it("holds when the global kill switch is on", () => {
    expect(advanceSequence(ctx({}, { killSwitch: true }))).toEqual({ kind: "hold" });
  });

  it("holds when the account is paused", () => {
    expect(advanceSequence(ctx({}, { accountPaused: true }))).toEqual({ kind: "hold" });
  });

  it("exhausts when no usable stage remains at all", () => {
    const channels = { linkedinUrl: null, email: null, emailStatus: "invalid", phone: null, phoneStatus: "invalid" };
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 0 }, { channels }));
    expect(d).toMatchObject({ kind: "exhaust" });
  });
});
