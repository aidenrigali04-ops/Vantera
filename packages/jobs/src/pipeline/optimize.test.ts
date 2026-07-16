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
  /** GATE 0 (enterprise-grade-brain spec, 2026-07-16): winning challengers land here, not `adopted` */
  readyToAdopt: { id: string; reason: string }[] = [];
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
  async markReadyToAdopt(id: string, reason: string) {
    this.readyToAdopt.push({ id, reason });
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
  // A/A canary (enterprise-grade-brain spec, WS-1.8) — seeding methods; not exercised by the
  // decide-pipeline tests below (those construct RunningExperiment rows directly), only present
  // to satisfy the OptimizeStore interface.
  async getCanaryAccountId(): Promise<string | null> {
    return null;
  }
  async ensureCanaryExperiment(_accountId: string): Promise<boolean> {
    return false;
  }
}

const exp = (id: string, over: Partial<RunningExperiment> = {}): RunningExperiment => ({
  id,
  accountId: "acct-1",
  stageKey: "reply",
  minSample: 30,
  championStrategy: {},
  // NOT `{}` — an A/A canary is champion === challenger (strategySignature), and every test in
  // this file below the canary describe block exercises a REAL (non-canary) experiment.
  challengerStrategy: { openWith: "trigger" },
  ...over,
});

describe("runOptimize (decide pipeline — GATE 0 suggest-only adopt, enterprise-grade-brain spec 2026-07-16)", () => {
  it("marks a winning challenger ready_to_adopt instead of adopting (GATE 0 suggest-only)", async () => {
    const store = new FakeOptimizeStore();
    // reply stage: champion 20% (100 accepted), challenger 40% (100 accepted), no negatives
    winningArms(store);

    const summary = await runOptimize({ store });

    expect(store.readyToAdopt).toHaveLength(1);
    expect(store.readyToAdopt[0]?.id).toBe("e1");
    // never autonomously adopts anymore
    expect(store.adopted).toHaveLength(0);
    // no chaining off a suggestion — the one-live unique index counts ready_to_adopt as live, so
    // the slot stays intentionally occupied until the owner acts
    expect(store.started).toHaveLength(0);
    expect(summary.readied).toBe(1);
    expect(summary.adopted).toBe(0);
    // not concluded either — the experiment isn't terminal, it's parked awaiting the owner
    expect(summary.concluded).toBe(0);
    expect(summary.chained).toBe(0);
  });

  it("still discards and halts autonomously (conservative actions keep their autonomy)", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [
      exp("e1"), // champion clearly better -> discard path unchanged
      exp("e2", { championStrategy: { followupLength: "standard" } }), // challenger harmful -> halt path unchanged
    ];
    // e1: champion 40% vs challenger 5%, no negatives -> discard
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 5 }))
    );
    // e2: challenger has higher interest but 20% negatives -> halt (do-no-harm circuit breaker)
    store.arms.set(
      "e2:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20, negative: i >= 97 }))
    );
    store.arms.set(
      "e2:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40, negative: i >= 80 }))
    );

    const summary = await runOptimize({ store });

    expect(store.concluded.map((c) => c.status).sort()).toEqual(["discarded", "halted"]);
    expect(store.readyToAdopt).toHaveLength(0);
    expect(store.adopted).toHaveLength(0);
    // both conservative paths still chain the next test — GATE 0 only touches the adopt branch
    expect(store.started).toHaveLength(2);
    expect(summary).toEqual({ evaluated: 2, concluded: 2, adopted: 0, chained: 2, readied: 0, canaryAlerts: 0 });
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
    expect(summary).toEqual({ evaluated: 1, concluded: 1, adopted: 0, chained: 1, readied: 0, canaryAlerts: 0 });
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

    expect(summary).toEqual({ evaluated: 1, concluded: 0, adopted: 0, chained: 0, readied: 0, canaryAlerts: 0 });
    expect(store.concluded).toHaveLength(0);
    expect(store.started).toHaveLength(0);
  });

  // ── Stage 1b: generate → gate → bandit challenger chaining ────────────────
  // GATE 0 note: chaining only happens off the discard/halt (conservative) branches now — the
  // adopt_challenger branch never calls chainNext (see the ready_to_adopt test above). These
  // fixtures exercise chaining through the still-autonomous discard path.
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

  const losingArms = (store: FakeOptimizeStore) => {
    store.experiments = [exp("e1")];
    // champion clearly better: 40% vs 5% -> discard path (still chains autonomously)
    store.arms.set(
      "e1:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 }))
    );
    store.arms.set(
      "e1:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 5 }))
    );
  };

  it("without a generator, chains exactly the deterministic knob-flip (pre-1b behavior)", async () => {
    const store = new FakeOptimizeStore();
    losingArms(store);
    await runOptimize({ store });
    expect(store.started[0]?.challenger).toEqual({ askStyle: "specific" }); // booking flip vs {} champion (discard path)
    expect(store.stampedOutcomesCalls).toBe(0);
  });

  it("with a generator, starts the bandit's choice — collective stats steer the pick", async () => {
    const store = new FakeOptimizeStore();
    losingArms(store);
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
        expect(input.champion).toEqual({}); // discard path chains off exp.championStrategy
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
    losingArms(store);
    await runOptimize({ store, proposeCandidatesFn: async () => [], rand: () => 0.5 });
    expect(store.started[0]?.challenger).toEqual({ askStyle: "specific" });
  });

  it("tolerates a chain-start conflict (another experiment already live) without throwing", async () => {
    const store = new FakeOptimizeStore();
    store.startConflicts = true;
    // discard path — the only path that still chains under GATE 0
    losingArms(store);

    const summary = await runOptimize({ store });

    expect(summary).toEqual({ evaluated: 1, concluded: 1, adopted: 0, chained: 0, readied: 0, canaryAlerts: 0 });
  });

  // ── A/A canary (enterprise-grade-brain spec, WS-1.8) ──────────────────────
  // A canary experiment has an IDENTICAL challenger (deep-equal to the champion via
  // strategySignature). Any decisive verdict on it is a false signal from the decide gate
  // itself — it must alert and count, but never act (no conclude/adopt/mark-ready/chain).
  describe("A/A canary", () => {
    it("a non-keep verdict alerts and does NOT conclude, adopt, or mark ready", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { openWith: "pain" };
      store.experiments = [exp("c1", { championStrategy: same, challengerStrategy: same })];
      // rig flags so decideExperiment returns adopt_challenger (clear win at n>=30, reply stage:
      // denominator = accepted, success = interested)
      store.arms.set(
        "c1:champion",
        flags(40, { accepted: true }).map((f, i) => ({ ...f, interested: i < 4 }))
      );
      store.arms.set(
        "c1:challenger",
        flags(40, { accepted: true }).map((f, i) => ({ ...f, interested: i < 16 }))
      );
      const alerts: string[] = [];

      const summary = await runOptimize({
        store,
        notifyCanaryAlert: async (i) => {
          alerts.push(i.decision);
        },
      });

      expect(summary.canaryAlerts).toBe(1);
      expect(alerts).toEqual(["adopt_challenger"]);
      // no state change on the canary:
      expect(store.readyToAdopt).toHaveLength(0);
      expect(store.concluded).toHaveLength(0);
      expect(store.adopted).toHaveLength(0);
      expect(store.started).toHaveLength(0);
      expect(summary).toEqual({ evaluated: 1, concluded: 0, adopted: 0, chained: 0, readied: 0, canaryAlerts: 1 });
    });

    it("a keep_running verdict does nothing (no alert)", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { openWith: "pain" };
      store.experiments = [exp("c1", { championStrategy: same, challengerStrategy: same })];
      // low n both arms -> keep_running (below minSample 30)
      store.arms.set(
        "c1:champion",
        flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 2 }))
      );
      store.arms.set(
        "c1:challenger",
        flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 3 }))
      );
      const alerts: string[] = [];

      const summary = await runOptimize({
        store,
        notifyCanaryAlert: async (i) => {
          alerts.push(i.decision);
        },
      });

      expect(alerts).toEqual([]);
      expect(summary).toEqual({ evaluated: 1, concluded: 0, adopted: 0, chained: 0, readied: 0, canaryAlerts: 0 });
      expect(store.readyToAdopt).toHaveLength(0);
      expect(store.concluded).toHaveLength(0);
      expect(store.adopted).toHaveLength(0);
    });

    it("without a notifyCanaryAlert callback, a decisive verdict still counts but never throws", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { openWith: "pain" };
      store.experiments = [exp("c1", { championStrategy: same, challengerStrategy: same })];
      store.arms.set(
        "c1:champion",
        flags(40, { accepted: true }).map((f, i) => ({ ...f, interested: i < 4 }))
      );
      store.arms.set(
        "c1:challenger",
        flags(40, { accepted: true }).map((f, i) => ({ ...f, interested: i < 16 }))
      );

      const summary = await runOptimize({ store });

      expect(summary.canaryAlerts).toBe(1);
      expect(store.readyToAdopt).toHaveLength(0);
    });
  });
});
