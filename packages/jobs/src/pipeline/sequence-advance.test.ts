import { describe, expect, it } from "vitest";
import { advanceSequence, INVITE_ACCEPT_TIMEOUT_DAYS, NEVER_INVITED_TIMEOUT_DAYS } from "./sequence-advance";
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
      nextActionAt: NOW, enteredStageAt: NOW, revivedAt: null, ...run,
    },
    config: SEQUENCE_DEFAULTS,
    channels: fullChannels,
    suppressed: { linkedin: false },
    accountPaused: false,
    killSwitch: false,
    leadReplied: false,
    // default: accepted well before the run's clock started (no acceptance reset)
    connection: { invitedAt: new Date(NOW.getTime() - 12 * DAY), connectedAt: new Date(NOW.getTime() - 10 * DAY) },
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

describe("advanceSequence — soft-no revival (0044)", () => {
  it("a run exhausting on a REPLIED lead parks once for the revival window instead of dying", async () => {
    const { SOFT_NO_REVIVAL_DAYS } = await import("./sequence-advance");
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { leadReplied: true }));
    expect(d.kind).toBe("park");
    if (d.kind !== "park") return;
    expect(d.patch.touchesDone).toBe(1); // exactly one touch of headroom
    expect(d.patch.revivedAt).toEqual(NOW); // the one-shot is spent
    expect(d.patch.nextActionAt?.getTime()).toBe(NOW.getTime() + SOFT_NO_REVIVAL_DAYS * DAY);
  });

  it("the revival never repeats — a revived run exhausts normally", () => {
    const d = advanceSequence(
      ctx({ currentStage: "linkedin", touchesDone: 2, revivedAt: NOW }, { leadReplied: true })
    );
    expect(d).toMatchObject({ kind: "exhaust" });
  });

  it("a lead who never replied gets no revival", () => {
    const d = advanceSequence(ctx({ currentStage: "linkedin", touchesDone: 2 }, { leadReplied: false }));
    expect(d).toMatchObject({ kind: "exhaust" });
  });

  it("a suppressed lead never revives — the skip path exhausts as before", () => {
    const d = advanceSequence(
      ctx({ currentStage: "linkedin", touchesDone: 0 }, { suppressed: { linkedin: true }, leadReplied: true })
    );
    expect(d).toMatchObject({ kind: "exhaust" });
  });
});

describe("advanceSequence — connection gating (prod 2026-10-22: touches spent before invites went out)", () => {
  const pending = (invitedDaysAgo: number | null) => ({
    invitedAt: invitedDaysAgo === null ? null : new Date(NOW.getTime() - invitedDaysAgo * DAY),
    connectedAt: null,
  });

  it("waits a day without spending a touch while the invite is unaccepted", () => {
    const d = advanceSequence(ctx({ touchesDone: 0 }, { connection: pending(2) }));
    expect(d.kind).toBe("wait");
    expect(d.kind === "wait" && d.patch).toEqual({ nextActionAt: new Date(NOW.getTime() + DAY) });
  });

  it("waits while the invite hasn't even been sent yet", () => {
    const d = advanceSequence(ctx({ touchesDone: 0, enteredStageAt: new Date(NOW.getTime() - 3 * DAY) }, { connection: pending(null) }));
    expect(d.kind).toBe("wait");
  });

  it("ends the run once an invite has gone unaccepted past the timeout", () => {
    const d = advanceSequence(ctx({ touchesDone: 0 }, { connection: pending(INVITE_ACCEPT_TIMEOUT_DAYS + 1) }));
    expect(d).toMatchObject({ kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } });
  });

  it("ends the run when the invite never went out within the never-invited timeout", () => {
    const d = advanceSequence(
      ctx({ enteredStageAt: new Date(NOW.getTime() - (NEVER_INVITED_TIMEOUT_DAYS + 1) * DAY) }, { connection: pending(null) })
    );
    expect(d.kind).toBe("exhaust");
  });

  it("restarts the clock at acceptance: the invite pair's follow-up is touch 1, the nudge comes a gap later", () => {
    const connectedAt = new Date(NOW.getTime() - 3_600_000); // accepted an hour ago
    const d = advanceSequence(
      ctx(
        { touchesDone: 2, enteredStageAt: new Date(NOW.getTime() - 5 * DAY) }, // touches spent pre-acceptance
        { connection: { invitedAt: new Date(NOW.getTime() - 3 * DAY), connectedAt } }
      )
    );
    expect(d.kind).toBe("wait");
    expect(d.kind === "wait" && d.patch).toEqual({
      touchesDone: 1,
      enteredStageAt: connectedAt,
      lastTouchAt: connectedAt,
      nextActionAt: new Date(connectedAt.getTime() + 2 * DAY), // touchGapDays
    });
  });

  it("after the reset, dispatches the second touch normally", () => {
    const connectedAt = new Date(NOW.getTime() - 2 * DAY);
    const d = advanceSequence(
      ctx({ touchesDone: 1, enteredStageAt: connectedAt }, { connection: { invitedAt: new Date(NOW.getTime() - 4 * DAY), connectedAt } })
    );
    expect(d).toMatchObject({ kind: "dispatch", touchNo: 2 });
  });
});
