import { describe, expect, it, vi } from "vitest";
import { driveSequenceRun, runSequenceTick } from "./sequence-orchestrate";
import { SEQUENCE_DEFAULTS } from "./sequence-config";
import type { OrchestrateDispatch, OrchestrateStore } from "./sequence-orchestrate";
import type {
  DueSequenceRun,
  LeadChannels,
  SequenceConfig,
  SequenceRun,
  SequenceRunPatch,
} from "./types";

const NOW = new Date("2026-06-14T12:00:00Z");

const fullChannels: LeadChannels = {
  linkedinUrl: "https://linkedin.com/in/x",
  email: "x@acme.com",
  emailStatus: "valid",
  phone: "+15555550100",
  phoneStatus: "valid",
};

function run(over: Partial<SequenceRun> = {}): SequenceRun {
  return {
    id: "r1",
    accountId: "a1",
    campaignId: "c1",
    leadId: "l1",
    status: "active",
    currentStage: "linkedin",
    touchesDone: 0,
    callAttempts: 0,
    nextActionAt: NOW,
    enteredStageAt: NOW,
    ...over,
  };
}

function dueItem(over: Partial<DueSequenceRun> = {}): DueSequenceRun {
  return {
    run: run(),
    channels: fullChannels,
    config: SEQUENCE_DEFAULTS,
    accountPaused: false,
    ...over,
  };
}

/** Fake store mirroring the call-dispatch.test.ts style: vi.fn defaults, override per case. */
function store(over: Partial<OrchestrateStore> = {}): OrchestrateStore {
  return {
    getDueSequenceRuns: vi.fn(async () => []),
    isKillSwitchOn: vi.fn(async () => false),
    suppressionFlags: vi.fn(async () => ({ linkedin: false, email: false, phone: false })),
    applyRunPatch: vi.fn(async () => true),
    archiveLead: vi.fn(async () => {}),
    enrollPendingLeads: vi.fn(async () => 0),
    getLiveCallerAgent: vi.fn(async () => ({ id: "caller1" })),
    ...over,
  } as OrchestrateStore;
}

function dispatch(over: Partial<OrchestrateDispatch> = {}): OrchestrateDispatch {
  return {
    dispatchTouch: vi.fn(async () => {}),
    dispatchCallBrief: vi.fn(async () => {}),
    ...over,
  };
}

function env(
  overStore: Partial<OrchestrateStore> = {},
  overDispatch: Partial<OrchestrateDispatch> = {},
  killSwitch = false
) {
  return { store: store(overStore), dispatch: dispatch(overDispatch), killSwitch, now: NOW };
}

describe("driveSequenceRun", () => {
  it("dispatches a fresh linkedin run via sequence-touch with the right payload", async () => {
    const e = env();
    const out = await driveSequenceRun(dueItem(), e);

    expect(out).toEqual({ dispatched: 1, archived: 0 });
    expect(e.dispatch.dispatchTouch).toHaveBeenCalledTimes(1);
    expect(e.dispatch.dispatchTouch).toHaveBeenCalledWith({
      runId: "r1",
      accountId: "a1",
      campaignId: "c1",
      leadId: "l1",
      stage: "linkedin",
      touchNo: 1,
    });
    expect(e.dispatch.dispatchCallBrief).not.toHaveBeenCalled();
  });

  it("claims (applyRunPatch) BEFORE firing the trigger", async () => {
    const calls: string[] = [];
    const e = env(
      { applyRunPatch: vi.fn(async () => (calls.push("claim"), true)) },
      { dispatchTouch: vi.fn(async () => void calls.push("trigger")) }
    );

    await driveSequenceRun(dueItem(), e);

    expect(calls).toEqual(["claim", "trigger"]);
    // claim is keyed on the run id + its current nextActionAt (the optimistic guard)
    expect(e.store.applyRunPatch).toHaveBeenCalledWith("r1", NOW, expect.any(Object));
  });

  it("does NOT fire a trigger when the claim is lost (another tick won the race)", async () => {
    const e = env({ applyRunPatch: vi.fn(async () => false) });

    const out = await driveSequenceRun(dueItem(), e);

    expect(out).toEqual({ dispatched: 0, archived: 0 });
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
    expect(e.dispatch.dispatchCallBrief).not.toHaveBeenCalled();
  });

  it("call stage claims (applyRunPatch) then dispatches call-brief with the live caller agent id", async () => {
    const e = env({ getLiveCallerAgent: vi.fn(async () => ({ id: "caller-xyz" })) });
    const item = dueItem({ run: run({ currentStage: "call", touchesDone: 0, callAttempts: 0 }) });

    const out = await driveSequenceRun(item, e);

    expect(out).toEqual({ dispatched: 1, archived: 0 });
    // the attempt/clock IS claimed when a caller agent is present
    expect(e.store.applyRunPatch).toHaveBeenCalledTimes(1);
    expect(e.store.applyRunPatch).toHaveBeenCalledWith("r1", NOW, expect.any(Object));
    expect(e.dispatch.dispatchCallBrief).toHaveBeenCalledTimes(1);
    expect(e.dispatch.dispatchCallBrief).toHaveBeenCalledWith({
      callerAgentId: "caller-xyz",
      accountId: "a1",
      leadIds: ["l1"],
    });
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
  });

  it("call stage with no live caller agent holds WITHOUT burning the attempt (no claim, no dispatch)", async () => {
    const e = env({ getLiveCallerAgent: vi.fn(async () => null) });
    const item = dueItem({ run: run({ currentStage: "call", touchesDone: 0, callAttempts: 0 }) });

    const out = await driveSequenceRun(item, e);

    expect(out).toEqual({ dispatched: 0, archived: 0 });
    // the claim must NOT happen: the attempt is not incremented and the clock is not advanced,
    // so the run stays due and retries on a later tick (same "nothing happened" shape as a hold)
    expect(e.store.applyRunPatch).not.toHaveBeenCalled();
    expect(e.store.archiveLead).not.toHaveBeenCalled();
    expect(e.dispatch.dispatchCallBrief).not.toHaveBeenCalled();
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
  });

  it("exhaust decision archives the lead", async () => {
    const e = env();
    // currentStage 'done' makes advanceSequence return exhaust directly
    const item = dueItem({ run: run({ currentStage: "done" }) });

    const out = await driveSequenceRun(item, e);

    expect(out).toEqual({ dispatched: 0, archived: 1 });
    expect(e.store.archiveLead).toHaveBeenCalledWith("l1", "c1");
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
  });

  it("advances past an unusable stage and dispatches the next stage in the same tick", async () => {
    // linkedin disabled => advanceSequence returns 'advance' to email, then dispatch on email.
    const config: SequenceConfig = {
      ...SEQUENCE_DEFAULTS,
      stages: {
        ...SEQUENCE_DEFAULTS.stages,
        linkedin: { ...SEQUENCE_DEFAULTS.stages.linkedin, enabled: false },
      },
    };
    const patches: SequenceRunPatch[] = [];
    const e = env({
      applyRunPatch: vi.fn(async (_id, _at, patch) => (patches.push(patch), true)),
    });
    const item = dueItem({ config, run: run({ currentStage: "linkedin", touchesDone: 0 }) });

    const out = await driveSequenceRun(item, e);

    expect(out).toEqual({ dispatched: 1, archived: 0 });
    // exactly one dispatch this tick, and it is the email stage (linkedin was skipped)
    expect(e.dispatch.dispatchTouch).toHaveBeenCalledTimes(1);
    expect(e.dispatch.dispatchTouch).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "email", touchNo: 1 })
    );
    // two claims: the advance, then the dispatch
    expect(patches.map((p) => p.currentStage)).toEqual(["email", undefined]);
  });

  it("holds (dispatches nothing) when the kill switch is on", async () => {
    const e = env({}, {}, /* killSwitch */ true);

    const out = await driveSequenceRun(dueItem(), e);

    expect(out).toEqual({ dispatched: 0, archived: 0 });
    expect(e.store.applyRunPatch).not.toHaveBeenCalled();
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
  });

  it("holds (dispatches nothing) when the account is paused", async () => {
    const e = env();
    const out = await driveSequenceRun(dueItem({ accountPaused: true }), e);

    expect(out).toEqual({ dispatched: 0, archived: 0 });
    expect(e.store.applyRunPatch).not.toHaveBeenCalled();
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
  });
});

describe("runSequenceTick", () => {
  it("enrolls, reads the kill switch + due runs, drives each, and tallies", async () => {
    const due = [
      dueItem(),
      dueItem({ run: run({ id: "r2", leadId: "l2", currentStage: "done" }) }),
    ];
    const d = dispatch();
    const s = store({
      enrollPendingLeads: vi.fn(async () => 5),
      getDueSequenceRuns: vi.fn(async () => due),
    });

    const out = await runSequenceTick({ store: s, dispatch: d, now: NOW });

    expect(out).toEqual({ enrolled: 5, due: 2, dispatched: 1, archived: 1 });
    expect(s.enrollPendingLeads).toHaveBeenCalledWith(NOW);
    expect(s.isKillSwitchOn).toHaveBeenCalled();
    expect(d.dispatchTouch).toHaveBeenCalledTimes(1); // r1 dispatched
    expect(s.archiveLead).toHaveBeenCalledWith("l2", "c1"); // r2 exhausted
  });

  it("dispatches nothing across the whole batch when the kill switch is on", async () => {
    const d = dispatch();
    const s = store({
      isKillSwitchOn: vi.fn(async () => true),
      getDueSequenceRuns: vi.fn(async () => [dueItem()]),
    });

    const out = await runSequenceTick({ store: s, dispatch: d, now: NOW });

    expect(out).toMatchObject({ due: 1, dispatched: 0, archived: 0 });
    expect(d.dispatchTouch).not.toHaveBeenCalled();
    expect(s.applyRunPatch).not.toHaveBeenCalled();
  });
});
