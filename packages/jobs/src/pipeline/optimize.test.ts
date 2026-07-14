import { describe, expect, it } from "vitest";
import { runOptimize } from "./optimize";
import type { OptimizeStore, RunningExperiment, StartExperimentInput } from "./types";
import type { CopyStrategy, ExperimentStatus, LeadOutcomeFlags } from "@vantera/agent-brains";

const flags = (n: number, o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags[] =>
  Array.from({ length: n }, () => ({
    invited: true,
    accepted: false,
    interested: false,
    negative: false,
    booked: false,
    converted: false,
    ...o,
  }));

class FakeOptimizeStore implements OptimizeStore {
  experiments: RunningExperiment[] = [];
  arms = new Map<string, LeadOutcomeFlags[]>(); // key `${id}:${variant}`
  concluded: { id: string; status: ExperimentStatus; reason: string }[] = [];
  adopted: { id: string; reason: string }[] = [];
  started: StartExperimentInput[] = [];
  /** what adoptChallenger returns as the new champion */
  adoptedChampion: CopyStrategy = { followupLength: "tight" };
  /** simulate the one-live-experiment unique index */
  startConflicts = false;
  // Stage 1b: collective aggregates + generation context
  stampedOutcomes: { strategy: CopyStrategy; flags: LeadOutcomeFlags }[] = [];
  conclusionsHistory: { label: string; status: string }[] = [];
  stampedOutcomesCalls = 0;
  recentConclusionsCalls = 0;

  async getRunningExperiments() {
    return this.experiments;
  }
  async getArmFlags(experimentId: string, variant: "champion" | "challenger") {
    return this.arms.get(`${experimentId}:${variant}`) ?? [];
  }
  async concludeExperiment(id: string, status: ExperimentStatus, reason: string) {
    this.concluded.push({ id, status, reason });
  }
  async adoptChallenger(id: string, reason: string) {
    this.adopted.push({ id, reason });
    return this.adoptedChampion;
  }
  async startExperiment(input: StartExperimentInput) {
    if (this.startConflicts) return false;
    this.started.push(input);
    return true;
  }
  async getStampedOutcomes() {
    this.stampedOutcomesCalls++;
    return this.stampedOutcomes;
  }
  async getRecentConclusions() {
    this.recentConclusionsCalls++;
    return this.conclusionsHistory;
  }
}

const exp = (id: string, over: Partial<RunningExperiment> = {}): RunningExperiment => ({
  id,
  accountId: "acct-1",
  stageKey: "reply",
  minSample: 30,
  championStrategy: {},
  ...over,
});

describe("runOptimize (decide pipeline — autonomous within the envelope, spec 2026-07-14)", () => {
  it("adopts a proven winner on its own and chains the next test on the rotated stage", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    // reply stage: champion 20% (100 accepted), challenger 40% (100 accepted), no negatives
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );

    const summary = await runOptimize({ store });

    expect(summary).toEqual({ evaluated: 1, concluded: 1, adopted: 1, chained: 1 });
    expect(store.adopted).toHaveLength(1);
    expect(store.adopted[0]?.id).toBe("e1");
    // never parks at ready_to_adopt anymore
    expect(store.concluded).toHaveLength(0);
    // chained: reply → booking, challenger flips the askStyle knob vs the NEW champion
    expect(store.started).toHaveLength(1);
    expect(store.started[0]).toMatchObject({
      accountId: "acct-1",
      stageKey: "booking",
      champion: store.adoptedChampion,
    });
    expect(store.started[0]?.challenger.askStyle).toBeDefined();
  });

  it("halts a harmful challenger and still chains the next test from the standing champion", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1", { championStrategy: { followupLength: "standard" } })];
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20, negative: i >= 97 }))
    );
    // challenger: higher interest but 20% negatives
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40, negative: i >= 80 }))
    );

    const summary = await runOptimize({ store });

    expect(store.concluded[0]?.status).toBe("halted");
    expect(store.adopted).toHaveLength(0);
    expect(summary).toEqual({ evaluated: 1, concluded: 1, adopted: 0, chained: 1 });
    expect(store.started[0]).toMatchObject({
      stageKey: "booking",
      champion: { followupLength: "standard" },
    });
  });

  it("discards an underperforming challenger and chains", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    // champion clearly better: 40% vs 5%
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 5 }))
    );

    const summary = await runOptimize({ store });

    expect(store.concluded[0]?.status).toBe("discarded");
    expect(summary.chained).toBe(1);
  });

  it("leaves an undecided experiment running — no conclusion, no chain", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    store.arms.set(
      "e1:champion",
      flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 2 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 3 }))
    );

    const summary = await runOptimize({ store });

    expect(summary).toEqual({ evaluated: 1, concluded: 0, adopted: 0, chained: 0 });
    expect(store.concluded).toHaveLength(0);
    expect(store.started).toHaveLength(0);
  });

  // ── Stage 1b: generate → gate → bandit challenger chaining ────────────────
  const winningArms = (store: FakeOptimizeStore) => {
    store.experiments = [exp("e1")];
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );
  };

  it("without a generator, chains exactly the deterministic knob-flip (pre-1b behavior)", async () => {
    const store = new FakeOptimizeStore();
    winningArms(store);
    await runOptimize({ store });
    expect(store.started[0]?.challenger).toEqual({ askStyle: "specific" }); // booking flip vs {followupLength:"tight"} champion
    expect(store.stampedOutcomesCalls).toBe(0);
  });

  it("with a generator, starts the bandit's choice — collective stats steer the pick", async () => {
    const store = new FakeOptimizeStore();
    winningArms(store);
    const angleCandidate: CopyStrategy = { openerAngle: "a peer just solved this pain" };
    // Collective aggregates massively favor the angle candidate on the booking stage
    store.stampedOutcomes = [
      ...Array.from({ length: 150 }, () => ({
        strategy: angleCandidate,
        flags: { invited: true, accepted: true, interested: true, negative: false, booked: true, converted: false },
      })),
      ...Array.from({ length: 150 }, () => ({
        strategy: { askStyle: "specific" as const },
        flags: { invited: true, accepted: true, interested: true, negative: false, booked: false, converted: false },
      })),
    ];
    let seed = 123456789;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32);
    const summary = await runOptimize({
      store,
      proposeCandidatesFn: async (input) => {
        expect(input.stageKey).toBe("booking"); // rotated from reply
        expect(input.champion).toEqual(store.adoptedChampion);
        return [{ askStyle: "specific" }, angleCandidate];
      },
      rand,
    });
    expect(summary.chained).toBe(1);
    expect(store.started[0]?.challenger).toEqual(angleCandidate);
    expect(store.stampedOutcomesCalls).toBe(1);
    expect(store.recentConclusionsCalls).toBe(1);
  });

  it("falls back to the knob-flip when generation returns no candidates", async () => {
    const store = new FakeOptimizeStore();
    winningArms(store);
    await runOptimize({ store, proposeCandidatesFn: async () => [], rand: () => 0.5 });
    expect(store.started[0]?.challenger).toEqual({ askStyle: "specific" });
  });

  it("tolerates a chain-start conflict (another experiment already live) without throwing", async () => {
    const store = new FakeOptimizeStore();
    store.startConflicts = true;
    store.experiments = [exp("e1")];
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );

    const summary = await runOptimize({ store });

    expect(summary).toEqual({ evaluated: 1, concluded: 1, adopted: 1, chained: 0 });
  });
});
