import { describe, expect, it } from "vitest";
import { runOptimize } from "./optimize";
import type { OptimizeStore, RunningExperiment } from "./types";
import type { ExperimentStatus, LeadOutcomeFlags } from "@vantera/agent-brains";

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

  async getRunningExperiments() {
    return this.experiments;
  }
  async getArmFlags(experimentId: string, variant: "champion" | "challenger") {
    return this.arms.get(`${experimentId}:${variant}`) ?? [];
  }
  async concludeExperiment(id: string, status: ExperimentStatus, reason: string) {
    this.concluded.push({ id, status, reason });
  }
}

const exp = (id: string): RunningExperiment => ({ id, stageKey: "reply", minSample: 30 });

describe("runOptimize (decide pipeline, suggest-only)", () => {
  it("parks a proven winner at ready_to_adopt — never adopts on its own", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    // reply stage: champion 20% (100 accepted), challenger 40% (100 accepted), no negatives
    store.arms.set("e1:champion", flags(100, { accepted: true, interested: false }).map((f, i) => ({ ...f, interested: i < 20 })));
    store.arms.set("e1:challenger", flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40 })));

    const summary = await runOptimize({ store });

    expect(summary).toEqual({ evaluated: 1, concluded: 1 });
    expect(store.concluded[0]!.status).toBe("ready_to_adopt");
  });

  it("halts a harmful challenger", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    store.arms.set("e1:champion", flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 20, negative: i >= 97 })));
    // challenger: higher interest but 20% negatives
    store.arms.set("e1:challenger", flags(100, { accepted: true }).map((f, i) => ({ ...f, interested: i < 40, negative: i >= 80 })));

    await runOptimize({ store });
    expect(store.concluded[0]!.status).toBe("halted");
  });

  it("leaves an undecided experiment running (no conclusion)", async () => {
    const store = new FakeOptimizeStore();
    store.experiments = [exp("e1")];
    store.arms.set("e1:champion", flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 2 })));
    store.arms.set("e1:challenger", flags(10, { accepted: true }).map((f, i) => ({ ...f, interested: i < 3 })));

    const summary = await runOptimize({ store });
    expect(summary.concluded).toBe(0);
    expect(store.concluded).toHaveLength(0);
  });
});
