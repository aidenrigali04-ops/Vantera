import { describe, expect, it, vi } from "vitest";
import { driveSequenceRun, runSequenceTick } from "./sequence-orchestrate";
import { SEQUENCE_DEFAULTS } from "./sequence-config";
import type { OrchestrateDispatch, OrchestrateStore } from "./sequence-orchestrate";
import type {
  DueSequenceRun,
  LeadChannels,
  SequenceConfig,
  SequenceRun,
} from "./types";

const NOW = new Date("2026-06-14T12:00:00Z");

const fullChannels: LeadChannels = {
  linkedinUrl: "https://linkedin.com/in/x",
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

/** Fake store: vi.fn defaults, override per case. */
function store(over: Partial<OrchestrateStore> = {}): OrchestrateStore {
  return {
    getDueSequenceRuns: vi.fn(async () => []),
    isKillSwitchOn: vi.fn(async () => false),
    suppressionFlags: vi.fn(async () => ({ linkedin: false })),
    applyRunPatch: vi.fn(async () => true),
    archiveLead: vi.fn(async () => {}),
    enrollPendingLeads: vi.fn(async () => 0),
    ...over,
  } as OrchestrateStore;
}

function dispatch(over: Partial<OrchestrateDispatch> = {}): OrchestrateDispatch {
  return {
    dispatchTouch: vi.fn(async () => {}),
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

  it("archives the lead when the only stage is disabled (nothing usable remains)", async () => {
    const config: SequenceConfig = {
      ...SEQUENCE_DEFAULTS,
      stages: {
        ...SEQUENCE_DEFAULTS.stages,
        linkedin: { ...SEQUENCE_DEFAULTS.stages.linkedin, enabled: false },
      },
    };
    const e = env();
    const item = dueItem({ config, run: run({ currentStage: "linkedin", touchesDone: 0 }) });

    const out = await driveSequenceRun(item, e);

    expect(out).toEqual({ dispatched: 0, archived: 1 });
    expect(e.store.archiveLead).toHaveBeenCalledWith("l1", "c1");
    expect(e.dispatch.dispatchTouch).not.toHaveBeenCalled();
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
