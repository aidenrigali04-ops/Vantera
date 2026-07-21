import { describe, expect, it } from "vitest";
import { GRACE_MS, runOptimize } from "./optimize";
import type { OptimizeStore, RunningExperiment, StartExperimentInput } from "./types";
import { ALPHA_MIN_SPEND, ALPHA_WEALTH_START, nextAlphaSpend } from "@vantera/agent-brains";
import type { CopyStrategy, ExperimentStatus, LeadOutcomeFlags } from "@vantera/agent-brains";

/**
 * Deterministic RNG for `decideExperimentV2`'s posterior Monte-Carlo read (Task 7 / WS-1.1's V2
 * wiring). Mirrors `packages/agent-brains/src/optimize/sim/harness.ts`'s `mulberry32` — duplicated
 * here rather than imported across the package boundary, since this file only needs a tiny
 * seedable generator. Seed 7 is the SAME seed `decide-v2.test.ts` validated the 9/60-vs-24/60
 * evidence rig against (e≈22.3, medianLiftPp≈±24 — adopt_challenger/discard_challenger resolve
 * cleanly); reused here rather than re-deriving new evidence. A constant/degenerate rng is NOT
 * safe to substitute: `posteriorSummary`'s Beta sampler (Marsaglia-Tsang rejection) can loop
 * forever on a non-varying input, so every fixture below that needs a decisive V2 verdict uses
 * this seeded generator rather than a hand-rolled placeholder.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * V2-clearing evidence rig, validated in `decide-v2.test.ts` with `mulberry32(7)`: champion 9/60
 * (15%) vs challenger 24/60 (40%) → e≈22.3 (clears the default threshold of 20), medianLiftPp≈24.4.
 * The mirrored pair (champion 24/60, challenger 9/60) discards with the same |e| and an equally
 * decisive negative lift. No negatives on either arm, so the do-no-harm breaker never trips —
 * these rigs exercise the e-process/posterior gate specifically.
 */
const ADOPT_CHAMP_SUCCESSES = 9;
const ADOPT_CHAL_SUCCESSES = 24;
const V2_ARM_N = 60;

class FakeOptimizeStore implements OptimizeStore {
  experiments: RunningExperiment[] = [];
  arms = new Map<string, LeadOutcomeFlags[]>(); // key `${id}:${variant}`
  /** `credit` records the resolved wealth-credit flag (opts.credit ?? true) per conclusion. */
  concluded: { id: string; status: ExperimentStatus; reason: string; credit: boolean }[] = [];
  adopted: { id: string; reason: string }[] = [];
  /** GATE 0 (enterprise-grade-brain spec, 2026-07-16): winning challengers land here, not `adopted` */
  readyToAdopt: { id: string; reason: string }[] = [];
  started: StartExperimentInput[] = [];
  /** what adoptChallenger returns as the new champion — null simulates a lost claim (WS-3.2:
   *  the owner already discarded/adopted the row in the race window, so the status-guarded
   *  claim inside the real store's adoptChallenger returned no row). */
  adoptedChampion: CopyStrategy | null = { followupLength: "tight" };
  /** simulate the one-live-experiment unique index */
  startConflicts = false;
  // Stage 1b: collective aggregates + generation context
  stampedOutcomes: { strategy: CopyStrategy; flags: LeadOutcomeFlags }[] = [];
  conclusionsHistory: { label: string; status: string }[] = [];
  stampedOutcomesCalls = 0;
  recentConclusionsCalls = 0;
  /** Task 7 / WS-1.1: the account's alpha-investing wealth — defaults to a fresh account's
   *  starting balance so existing chaining behavior is unaffected unless a test overrides it. */
  alphaWealth = ALPHA_WEALTH_START;
  getAlphaWealthCalls = 0;
  /** GATE 1 / WS-3.2: the global `adoption_mode` app-setting — 'manual' is the real store's
   *  default (byte-identical to GATE 0 until a test explicitly opts into 'auto'). */
  adoptionMode: "auto" | "manual" = "manual";
  /** GATE 1 / WS-3.2: experiments the fake considers "mature" (readied_at ≥ graceMs ago) this
   *  tick — tests set this directly rather than simulating a real clock. */
  matureReadyToAdopt: RunningExperiment[] = [];
  getMatureReadyToAdoptCalls = 0;
  lastGraceMs: number | null = null;
  /** every getArmFlags call, in order — lets a test prove a canary was skipped BEFORE any
   *  re-verification read was attempted (design point (a): skip precedes re-verify). */
  armFlagsCalls: { id: string; variant: "champion" | "challenger" }[] = [];

  async getRunningExperiments() {
    return this.experiments;
  }
  async getArmFlags(experimentId: string, variant: "champion" | "challenger") {
    this.armFlagsCalls.push({ id: experimentId, variant });
    return this.arms.get(`${experimentId}:${variant}`) ?? [];
  }
  async concludeExperiment(
    id: string,
    status: ExperimentStatus,
    reason: string,
    opts?: { credit?: boolean }
  ) {
    this.concluded.push({ id, status, reason, credit: opts?.credit ?? true });
  }
  async adoptChallenger(id: string, reason: string) {
    this.adopted.push({ id, reason });
    return this.adoptedChampion;
  }
  // ^ NOTE: this fake records every call regardless of the configured return value — it doesn't
  // simulate the real store's claim internally. `adoptedChampion = null` is how a test simulates
  // the real store's status-guarded claim losing the race (see the WS-3.2 test below); `store.adopted`
  // still reflects "the pipeline attempted this claim," which is what these tests assert on.
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
  // Message-shape selector (spec §7): bold-shape pin list. Not exercised by most tests (default
  // empty); the trigger reads it and passes it via deps.boldShapesAccountIds.
  async getBoldShapesAccountIds(): Promise<string[]> {
    return [];
  }
  async getAlphaWealth(_accountId: string): Promise<number> {
    this.getAlphaWealthCalls++;
    return this.alphaWealth;
  }
  async getAdoptionMode(): Promise<"auto" | "manual"> {
    return this.adoptionMode;
  }
  async getMatureReadyToAdopt(graceMs: number): Promise<RunningExperiment[]> {
    this.getMatureReadyToAdoptCalls++;
    this.lastGraceMs = graceMs;
    return this.matureReadyToAdopt;
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
  // null = a pre-2A row (honest legacy) — decideExperimentV2 self-clamps this to its own default
  // alpha (0.05, e-threshold 20). Tests that need a TIGHTER per-experiment alpha override this.
  alphaSpent: null,
  ...over,
});

describe("runOptimize (decide pipeline — GATE 0 suggest-only adopt, enterprise-grade-brain spec 2026-07-16)", () => {
  it("marks a winning challenger ready_to_adopt instead of adopting (GATE 0 suggest-only)", async () => {
    const store = new FakeOptimizeStore();
    // reply stage: champion 9/60 (15%), challenger 24/60 (40%), no negatives — the validated
    // V2-clearing rig (e≈22.3 with mulberry32(7), well above the default threshold of 20).
    winningArms(store);

    const summary = await runOptimize({ store, rand: mulberry32(7) });

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

  it("uses the experiment's OWN alphaSpent as the e-value threshold, not the default (Task 7 / WS-1.1)", async () => {
    const store = new FakeOptimizeStore();
    // Same 9/60-vs-24/60 rig (e≈22.3) — decisive at the default alpha (0.05, threshold 20), but
    // NOT at a tighter per-experiment alpha of 0.01 (threshold 100). Proves the pipeline actually
    // passes exp.alphaSpent through to decideExperimentV2 rather than always using the default.
    store.experiments = [exp("e1", { alphaSpent: 0.01 })];
    store.arms.set(
      "e1:champion",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
    );
    store.arms.set(
      "e1:challenger",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
    );

    const summary = await runOptimize({ store, rand: mulberry32(7) });

    expect(store.readyToAdopt).toHaveLength(0);
    expect(store.concluded).toHaveLength(0);
    expect(summary).toEqual({
      evaluated: 1,
      concluded: 0,
      adopted: 0,
      chained: 0,
      chainPaused: 0,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
  });

  it("still discards and halts autonomously (conservative actions keep their autonomy)", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [
      exp("e1"), // champion clearly better -> discard path unchanged
      exp("e2", { championStrategy: { followupLength: "standard" } }), // challenger harmful -> halt path unchanged
    ];
    // e1: champion 24/60 (40%) vs challenger 9/60 (15%), no negatives -> discard (the mirrored
    // V2-clearing rig: e≈22.3, medianLiftPp≈-24)
    store.arms.set(
      "e1:champion",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
    );
    store.arms.set(
      "e1:challenger",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
    );
    // e2: challenger has higher interest but 20% negatives -> halt (do-no-harm circuit breaker,
    // shared verbatim between decideExperiment/decideExperimentV2 — fires before any e-value math)
    store.arms.set(
      "e2:champion",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20, negative: i >= 97 }))
    );
    store.arms.set(
      "e2:challenger",
      flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40, negative: i >= 80 }))
    );

    const summary = await runOptimize({ store, rand: mulberry32(7) });

    expect(store.concluded.map((c) => c.status).sort()).toEqual(["discarded", "halted"]);
    expect(store.readyToAdopt).toHaveLength(0);
    expect(store.adopted).toHaveLength(0);
    // both conservative paths still chain the next test — GATE 0 only touches the adopt branch
    expect(store.started).toHaveLength(2);
    expect(summary).toEqual({
      evaluated: 2,
      concluded: 2,
      adopted: 0,
      chained: 2,
      chainPaused: 0,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
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

    const summary = await runOptimize({ store, rand: mulberry32(7) });

    expect(store.concluded[0]?.status).toBe("halted");
    expect(store.adopted).toHaveLength(0);
    expect(summary).toEqual({
      evaluated: 1,
      concluded: 1,
      adopted: 0,
      chained: 1,
      chainPaused: 0,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
    expect(store.started[0]).toMatchObject({
      stageKey: "booking",
      champion: { followupLength: "standard" },
    });
  });

  it("discards an underperforming challenger and chains", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    // champion clearly better: 24/60 (40%) vs 9/60 (15%) — the mirrored V2-clearing rig
    store.arms.set(
      "e1:champion",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
    );
    store.arms.set(
      "e1:challenger",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
    );

    const summary = await runOptimize({ store, rand: mulberry32(7) });

    expect(store.concluded[0]?.status).toBe("discarded");
    // a verdict-driven discard is a DECISIVE conclusion — it earns wealth back (default credit)
    expect(store.concluded[0]?.credit).toBe(true);
    expect(summary.chained).toBe(1);
    // Task 7 / WS-1.1: the chained experiment's alphaSpent is nextAlphaSpend of the account's
    // wealth (default ALPHA_WEALTH_START here — see FakeOptimizeStore.alphaWealth).
    expect(store.started[0]?.alphaSpent).toBeCloseTo(nextAlphaSpend(ALPHA_WEALTH_START)!, 10);
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

    expect(summary).toEqual({
      evaluated: 1,
      concluded: 0,
      adopted: 0,
      chained: 0,
      chainPaused: 0,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
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
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
    );
    store.arms.set(
      "e1:challenger",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
    );
  };

  const losingArms = (store: FakeOptimizeStore) => {
    store.experiments = [exp("e1")];
    // champion clearly better: 24/60 (40%) vs 9/60 (15%) -> discard path (still chains
    // autonomously) — the mirrored V2-clearing rig (e≈22.3 with mulberry32(7))
    store.arms.set(
      "e1:champion",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
    );
    store.arms.set(
      "e1:challenger",
      flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
    );
  };

  it("without a generator, chains exactly the deterministic knob-flip (pre-1b behavior)", async () => {
    const store = new FakeOptimizeStore();
    losingArms(store);
    await runOptimize({ store, rand: mulberry32(7) });
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

  it("passes boldShapesAllowed to the generator ONLY for a pinned account (spec §7)", async () => {
    // pinned: exp.accountId ("acct-1") is in the deps pin list → the generator may explore bold shapes
    const pinned = new FakeOptimizeStore();
    losingArms(pinned);
    let seenPinned: boolean | undefined;
    await runOptimize({
      store: pinned,
      boldShapesAccountIds: ["acct-1", "other"],
      proposeCandidatesFn: async (input) => {
        seenPinned = input.boldShapesAllowed;
        return [{ askStyle: "specific" }];
      },
      rand: mulberry32(7),
    });
    expect(seenPinned).toBe(true);

    // not pinned: the same account is absent from the list → safe subset only
    const notPinned = new FakeOptimizeStore();
    losingArms(notPinned);
    let seenNotPinned: boolean | undefined;
    await runOptimize({
      store: notPinned,
      boldShapesAccountIds: ["some-other-account"],
      proposeCandidatesFn: async (input) => {
        seenNotPinned = input.boldShapesAllowed;
        return [{ askStyle: "specific" }];
      },
      rand: mulberry32(7),
    });
    expect(seenNotPinned).toBe(false);
  });

  it("falls back to the knob-flip when generation returns no candidates", async () => {
    const store = new FakeOptimizeStore();
    losingArms(store);
    // NOTE: a constant rng (e.g. `() => 0.5`) is NOT safe here now that decideExperimentV2's
    // posterior read also consumes `rand` — sampleGamma's Marsaglia-Tsang rejection loop can spin
    // forever on a non-varying input. mulberry32(7) is the proven-safe seeded generator (see the
    // module doc above).
    await runOptimize({ store, proposeCandidatesFn: async () => [], rand: mulberry32(7) });
    expect(store.started[0]?.challenger).toEqual({ askStyle: "specific" });
  });

  it("tolerates a chain-start conflict (another experiment already live) without throwing", async () => {
    const store = new FakeOptimizeStore();
    store.startConflicts = true;
    // discard path — the only path that still chains under GATE 0
    losingArms(store);

    const summary = await runOptimize({ store, rand: mulberry32(7) });

    expect(summary).toEqual({
      evaluated: 1,
      concluded: 1,
      adopted: 0,
      chained: 0,
      chainPaused: 0,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
  });

  it("pauses the chain instead of launching when alpha-investing wealth is exhausted (Task 7 / WS-1.1)", async () => {
    const store = new FakeOptimizeStore();
    losingArms(store); // discard path — the only path that still chains under GATE 0
    store.alphaWealth = ALPHA_MIN_SPEND - 0.001; // below the pause floor — nextAlphaSpend returns null

    const summary = await runOptimize({
      store,
      rand: mulberry32(7),
      // proves the pause check runs BEFORE any candidate-generation work (chainNext reads wealth
      // first) — this would throw and fail the test if the generator were ever invoked.
      proposeCandidatesFn: async () => {
        throw new Error("must not generate candidates for a paused chain");
      },
    });

    expect(store.concluded[0]?.status).toBe("discarded"); // the conclusion itself is unaffected
    expect(store.started).toHaveLength(0); // nothing launched
    expect(store.getAlphaWealthCalls).toBe(1);
    expect(summary).toEqual({
      evaluated: 1,
      concluded: 1,
      adopted: 0,
      chained: 0,
      chainPaused: 1,
      readied: 0,
      canaryAlerts: 0,
      autoAdopted: 0,
    });
  });

  // ── A/A canary (enterprise-grade-brain spec, WS-1.8) ──────────────────────
  // A canary experiment has an IDENTICAL challenger (deep-equal to the champion via
  // strategySignature) AND lives on the pinned canary account (review-round fix: canary
  // semantics are scoped to `canaryAccountId`, never any identical-arm experiment anywhere).
  // Any decisive verdict on it is a false signal from the decide gate itself — it must alert and
  // count, but never act (no conclude/adopt/mark-ready/chain).
  describe("A/A canary", () => {
    it("a non-keep verdict alerts and does NOT conclude, adopt, or mark ready", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { openWith: "pain" };
      store.experiments = [exp("c1", { championStrategy: same, challengerStrategy: same })];
      // rig flags so decideExperimentV2 returns adopt_challenger (the validated V2-clearing rig:
      // e≈22.3 with mulberry32(7), reply stage: denominator = accepted, success = interested)
      store.arms.set(
        "c1:champion",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );
      store.arms.set(
        "c1:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );
      const alerts: string[] = [];

      const summary = await runOptimize({
        store,
        canaryAccountId: "acct-1", // exp()'s default accountId — this experiment IS the canary
        rand: mulberry32(7),
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
      expect(summary).toEqual({
        evaluated: 1,
        concluded: 0,
        adopted: 0,
        chained: 0,
        chainPaused: 0,
        readied: 0,
        canaryAlerts: 1,
        autoAdopted: 0,
      });
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
        canaryAccountId: "acct-1",
        notifyCanaryAlert: async (i) => {
          alerts.push(i.decision);
        },
      });

      expect(alerts).toEqual([]);
      expect(summary).toEqual({
        evaluated: 1,
        concluded: 0,
        adopted: 0,
        chained: 0,
        chainPaused: 0,
        readied: 0,
        canaryAlerts: 0,
        autoAdopted: 0,
      });
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
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );
      store.arms.set(
        "c1:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );

      const summary = await runOptimize({ store, canaryAccountId: "acct-1", rand: mulberry32(7) });

      expect(summary.canaryAlerts).toBe(1);
      expect(store.readyToAdopt).toHaveLength(0);
    });
  });

  // ── Identical-arm experiment on a NON-canary account (review-round fix) ───────────────────
  // The manual "start the test" web action used to build its challenger champion-blind: once an
  // owner adopted a stage's fixed challenger as the new champion, clicking start again produced a
  // signature-equal experiment on a real CUSTOMER account. Under canary semantics that would have
  // been an accidental, permanent A/A test occupying the one-live slot forever and alerting the
  // customer. The fix: identical arms on any account OTHER than the pinned canary are concluded
  // discarded immediately (regardless of sample size — there's nothing to learn), freeing the
  // slot, with the chain continuing exactly like any other discard. Never alerted.
  describe("identical-arm experiment on a non-canary account", () => {
    it("concludes discarded with the exact reason, chains, and never alerts — even below minSample", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { followupLength: "tight" };
      // accountId "acct-1" (exp()'s default) is NOT the pinned canary account below, and the
      // arms are deliberately kept tiny so decideExperiment alone would return keep_running —
      // proving the identical-arm conclusion fires independent of sample size / verdict.
      store.experiments = [exp("e1", { championStrategy: same, challengerStrategy: same })];
      store.arms.set("e1:champion", flags(2, { accepted: true }));
      store.arms.set("e1:challenger", flags(2, { accepted: true }));
      const alerts: string[] = [];

      const summary = await runOptimize({
        store,
        canaryAccountId: "some-other-account", // acct-1 is NOT this — no canary exemption
        notifyCanaryAlert: async (i) => {
          alerts.push(i.decision);
        },
      });

      expect(alerts).toEqual([]); // never a calibration alert — this is a duplicate-arm mistake
      expect(store.concluded).toEqual([
        {
          id: "e1",
          status: "discarded",
          reason: "identical champion and challenger — no testable difference",
          // administrative cleanup, NOT a decisive conclusion — earns no alpha wealth back (a heal
          // typically closes an unfunded manual experiment; crediting it would mint free wealth)
          credit: false,
        },
      ]);
      expect(store.readyToAdopt).toHaveLength(0);
      expect(store.adopted).toHaveLength(0);
      // frees the slot AND chains the next test, same as any other discard conclusion
      expect(store.started).toHaveLength(1);
      expect(summary).toEqual({
        evaluated: 1,
        concluded: 1,
        adopted: 0,
        chained: 1,
        chainPaused: 0,
        readied: 0,
        canaryAlerts: 0,
        autoAdopted: 0,
      });
    });

    it("also fires with no canaryAccountId configured at all (null/undefined default)", async () => {
      const store = new FakeOptimizeStore();
      const same: CopyStrategy = { openWith: "trigger" };
      store.experiments = [exp("e1", { championStrategy: same, challengerStrategy: same })];
      store.arms.set("e1:champion", flags(50, { accepted: true }).map((f, i) => ({ ...f, interested: i < 10 })));
      store.arms.set("e1:challenger", flags(50, { accepted: true }).map((f, i) => ({ ...f, interested: i < 10 })));

      // no canaryAccountId passed at all — deps.canaryAccountId is undefined
      const summary = await runOptimize({ store });

      expect(store.concluded[0]).toMatchObject({ status: "discarded" });
      expect(summary.canaryAlerts).toBe(0);
      expect(summary.concluded).toBe(1);
    });
  });

  // ── GATE 1 (enterprise-grade-brain spec, WS-3.2): config-gated auto-adopt after grace ────────
  // Everything above this block exercises the per-tick decide loop, unchanged. This block
  // exercises the NEW pass that runs after it: config-gated (`adoption_mode`, default 'manual'),
  // acting only on experiments `getMatureReadyToAdopt` already filtered to "readied_at at least
  // GRACE_MS ago" — the fake simulates that filter directly (tests set `matureReadyToAdopt`
  // rather than a real clock) since the real WHERE-clause filtering is pg-store's job, not the
  // pure core's.
  describe("auto-adopt after grace + re-verify (GATE 1, WS-3.2)", () => {
    it("adoption_mode='manual' (the default) never runs the auto-adopt pass — byte-identical to GATE 0", async () => {
      const store = new FakeOptimizeStore();
      winningArms(store); // still marks ready_to_adopt via the ordinary per-tick loop
      // Even a mature row sitting in the store must never be looked at in manual mode.
      const wouldBeMature = exp("would-be-mature", { accountId: "acct-9" });
      store.matureReadyToAdopt = [wouldBeMature];
      store.arms.set(
        "would-be-mature:champion",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );
      store.arms.set(
        "would-be-mature:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );

      const summary = await runOptimize({ store, rand: mulberry32(7) });

      // manual mode short-circuits BEFORE even asking what's mature — proves the flip is truly a
      // no-op, not "asks but ignores the answer"
      expect(store.getMatureReadyToAdoptCalls).toBe(0);
      expect(store.adopted).toHaveLength(0);
      expect(summary.autoAdopted).toBe(0);
      // the pre-existing suggest-only behavior is completely untouched
      expect(store.readyToAdopt).toHaveLength(1);
      expect(summary.readied).toBe(1);
    });

    it("adoption_mode='auto' + a mature win that STILL clears re-verification → adopts + chains", async () => {
      const store = new FakeOptimizeStore();
      store.adoptionMode = "auto";
      const mature = exp("m1", { accountId: "acct-2" });
      store.matureReadyToAdopt = [mature];
      // same V2-clearing rig as winningArms — the 24h-later data still says adopt
      store.arms.set(
        "m1:champion",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );
      store.arms.set(
        "m1:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );

      const summary = await runOptimize({ store, rand: mulberry32(7) });

      expect(store.getMatureReadyToAdoptCalls).toBe(1);
      expect(store.lastGraceMs).toBe(GRACE_MS);
      expect(store.adopted).toEqual([{ id: "m1", reason: expect.any(String) }]);
      expect(summary.autoAdopted).toBe(1);
      // chains the next test off the NEW champion (adoptChallenger's return value), same as the
      // pre-GATE-0 fully-autonomous adopt path
      expect(store.started).toHaveLength(1);
      expect(store.started[0]).toMatchObject({ accountId: "acct-2", champion: store.adoptedChampion });
      expect(summary.chained).toBe(1);
    });

    // Review-round fix (WS-3.2): the daily auto-adopt tick is the first concurrent actor racing
    // the owner's manual dashboard buttons. If the owner discarded/adopted this exact experiment
    // in the window between `getMatureReadyToAdopt` reading it and this tick reaching it, the real
    // store's status-guarded claim inside `adoptChallenger` finds the row already transitioned and
    // returns null — simulated here via `adoptedChampion = null`. The pipeline must treat that as
    // "someone else already decided" and skip silently: no autoAdopted count, no chain off a
    // champion that was never actually written to the playbook.
    it("adoption_mode='auto' + adoptChallenger loses the claim (owner acted in the race window) → not counted, no chain", async () => {
      const store = new FakeOptimizeStore();
      store.adoptionMode = "auto";
      const mature = exp("m-race", { accountId: "acct-5" });
      store.matureReadyToAdopt = [mature];
      // same V2-clearing rig — the re-verify itself still says adopt; only the claim is lost
      store.arms.set(
        "m-race:champion",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );
      store.arms.set(
        "m-race:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );
      store.adoptedChampion = null;

      const summary = await runOptimize({ store, rand: mulberry32(7) });

      expect(store.adopted).toEqual([{ id: "m-race", reason: expect.any(String) }]); // the claim was attempted
      expect(summary.autoAdopted).toBe(0);
      expect(store.started).toHaveLength(0); // no chain off a null champion
      expect(summary.chained).toBe(0);
      // not re-conceded as a discard either — a lost claim is neither an adoption nor a discard,
      // it's a silent no-op deferring to whatever the owner's own action already did
      expect(store.concluded).toHaveLength(0);
    });

    it("adoption_mode='auto' + a mature win that regressed on re-verify → NOT adopted, concluded discarded", async () => {
      const store = new FakeOptimizeStore();
      store.adoptionMode = "auto";
      const mature = exp("m2", { accountId: "acct-3", championStrategy: { followupLength: "standard" } });
      store.matureReadyToAdopt = [mature];
      // mirrored rig: champion now clearly AHEAD of the challenger — the win didn't hold up
      store.arms.set(
        "m2:champion",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAL_SUCCESSES }))
      );
      store.arms.set(
        "m2:challenger",
        flags(V2_ARM_N, { accepted: true }).map((f, i) => ({ ...f, interested: i < ADOPT_CHAMP_SUCCESSES }))
      );

      const summary = await runOptimize({ store, rand: mulberry32(7) });

      expect(store.adopted).toHaveLength(0);
      expect(summary.autoAdopted).toBe(0);
      expect(store.concluded).toEqual([
        {
          id: "m2",
          status: "discarded",
          reason: expect.stringContaining("grace re-check failed"),
          credit: true,
        },
      ]);
      // still chains the next test off the STANDING champion — an account never sits idle just
      // because a 24h-old suggestion didn't pan out (same invariant every other discard keeps)
      expect(store.started).toHaveLength(1);
      expect(store.started[0]).toMatchObject({ champion: { followupLength: "standard" } });
    });

    it("adoption_mode='auto' + ready_to_adopt but under 24h old — not yet adopted", async () => {
      const store = new FakeOptimizeStore();
      store.adoptionMode = "auto";
      winningArms(store); // marks a FRESH winner ready_to_adopt this very tick
      store.matureReadyToAdopt = []; // nothing crosses the grace threshold yet — simulates <24h

      const summary = await runOptimize({ store, rand: mulberry32(7) });

      expect(store.getMatureReadyToAdoptCalls).toBe(1); // the auto pass DID run (mode is 'auto')
      expect(store.adopted).toHaveLength(0);
      expect(summary.autoAdopted).toBe(0);
      // the fresh mark from the ordinary per-tick loop is untouched
      expect(store.readyToAdopt).toHaveLength(1);
      expect(summary.readied).toBe(1);
    });

    it("never auto-adopts a canary-account experiment even in auto mode (belt-and-suspenders)", async () => {
      const store = new FakeOptimizeStore();
      store.adoptionMode = "auto";
      const canaryMature = exp("c-mature", { accountId: "canary-acct" });
      store.matureReadyToAdopt = [canaryMature];
      // deliberately no arms configured for "c-mature" — if the pass ever tried to re-verify it,
      // armFlagsCalls would record the attempt. Canaries never actually reach ready_to_adopt in
      // production (the interception in the main loop exempts them from every action branch,
      // including markReadyToAdopt), so this is pure belt-and-suspenders.
      const summary = await runOptimize({
        store,
        canaryAccountId: "canary-acct",
        rand: mulberry32(7),
      });

      expect(store.adopted).toHaveLength(0);
      expect(store.concluded).toHaveLength(0);
      expect(summary.autoAdopted).toBe(0);
      // proves the skip happens BEFORE any re-verification read is attempted
      expect(store.armFlagsCalls).toHaveLength(0);
    });
  });
});
