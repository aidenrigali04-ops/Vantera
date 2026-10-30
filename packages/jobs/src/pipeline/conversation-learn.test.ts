import { describe, expect, it } from "vitest";
import type { DecisionOutcome, PriorTable } from "@vantera/agent-brains";
import { MATURITY_MS, runConversationLearn } from "./conversation-learn";
import type { ConversationLearnStore, ConversationStore, ScorableDecision } from "./types";

const NOW = new Date("2026-10-29T12:00:00Z");
const zero: DecisionOutcome = {
  replied: false, stance: null, furtherLeadTurns: 0, booked: false,
  optOut: false, identitySuspicion: false, humanTakeover: false, waitThenReply: false,
};

const dec = (o: Partial<ScorableDecision> & { id: string }): ScorableDecision => ({
  accountId: "a1", leadId: "l1", scheduledSendId: "s1", decidedAt: new Date(NOW.getTime() - 8 * 86_400_000),
  move: "soft_ask", phase: "engaged", archetype: "ic_mgr:low:low", propensity: 0.5,
  composedBody: "hi", sentBody: "hi", sentAt: new Date(NOW.getTime() - 8 * 86_400_000), sendStatus: "sent", nextDecisionAt: null, ...o,
});

function fake(decisions: ScorableDecision[], outcomes: Record<string, DecisionOutcome>, hasSim = false) {
  const scored: { id: string; outcome: unknown; reward: number | null }[] = [];
  const upserts: { accountId: string | null; cells: PriorTable }[] = [];
  let askedOlderThan: Date | null = null;
  const tables = new Map<string, PriorTable>();
  let sinceSeen: Date | null = null;
  const store = {
    async listUnscoredDecisions(olderThan: Date) {
      askedOlderThan = olderThan;
      return decisions.filter((d) => d.decidedAt <= olderThan);
    },
    async scoreDecision(id: string, outcome: unknown, reward: number | null) {
      scored.push({ id, outcome, reward });
    },
    async listScoredDecisions(accountId: string | null, _limit: number, since: Date) {
      sinceSeen = since;
      return scored
        .filter((s) => s.reward !== null)
        .map((s) => ({ s, d: decisions.find((d) => d.id === s.id)! }))
        .filter(({ d }) => accountId === null || d.accountId === accountId)
        .map(({ s, d }) => ({
          accountId: d.accountId, move: d.move, phase: d.phase, archetype: d.archetype,
          propensity: d.propensity, reward: s.reward as number,
        }));
    },
    async upsertPriors(accountId: string | null, cells: PriorTable) {
      upserts.push({ accountId, cells });
      // scope replace: account rows replace that account; global replaces only 'real'
      const key = accountId ?? "__global";
      const kept = accountId === null ? (tables.get(key) ?? []).filter((c) => c.source !== "real") : [];
      tables.set(key, [...kept, ...cells]);
    },
    async hasGlobalPriors() { return hasSim; },
    async outcomeFor(d: ScorableDecision) { return outcomes[d.id] ?? zero; },
  } as unknown as ConversationStore & ConversationLearnStore;
  return { store, scored, upserts, tables, since: () => sinceSeen, asked: () => askedOlderThan };
}

describe("runConversationLearn", () => {
  it("rolls a booked decision into move, move_phase and move_phase_archetype for account and global", async () => {
    const f = fake([dec({ id: "d1" })], { d1: { ...zero, replied: true, booked: true } });
    const r = await runConversationLearn({ store: f.store, now: () => NOW });
    expect(r.scored).toBe(1);
    const acct = f.upserts.find((u) => u.accountId === "a1")!;
    const glob = f.upserts.find((u) => u.accountId === null)!;
    expect(acct.cells.map((c) => c.level).sort()).toEqual(["move", "move_phase", "move_phase_archetype"]);
    expect(glob.cells).toHaveLength(3);
    expect(r.cellsAccount).toBe(3);
    expect(r.cellsGlobal).toBe(3);
    expect(acct.cells[0]!.source).toBe("real");
    expect(acct.cells[0]!.positives).toBeGreaterThan(0);
  });

  it("excludes edited sends from scoring and rollup", async () => {
    const f = fake([dec({ id: "d1", sentBody: "edited by human" })], {});
    const r = await runConversationLearn({ store: f.store, now: () => NOW });
    expect(r.excluded).toBe(1);
    expect(r.scored).toBe(0);
    expect(f.scored[0]!.reward).toBeNull();
    expect((f.scored[0]!.outcome as { offPolicy: boolean }).offPolicy).toBe(true);
    expect(r.cellsAccount).toBe(0);
    expect(r.cellsGlobal).toBe(0);
  });

  it("does not score decisions younger than 7 days", async () => {
    const young = dec({ id: "d1", decidedAt: new Date(NOW.getTime() - 6 * 86_400_000) });
    const f = fake([young], {});
    const r = await runConversationLearn({ store: f.store, now: () => NOW });
    expect(r.scored + r.excluded).toBe(0);
    expect(f.scored).toHaveLength(0);
    expect(f.asked()!.getTime()).toBe(NOW.getTime() - MATURITY_MS);
  });

  it("seeds sim priors only when the global table has none", async () => {
    const sim = [{ level: "move", move: "answer", phase: "", archetype: "", source: "sim", count: 1, n: 1, positives: 1, rewardSum: 1, rewardSq: 1 }] as PriorTable;
    const a = fake([], {}, false);
    expect((await runConversationLearn({ store: a.store, now: () => NOW, simPriors: sim })).seededSim).toBe(true);
    expect(a.upserts).toContainEqual({ accountId: null, cells: sim });
    const b = fake([], {}, true);
    expect((await runConversationLearn({ store: b.store, now: () => NOW, simPriors: sim })).seededSim).toBe(false);
    const c = fake([], {}, false);
    expect((await runConversationLearn({ store: c.store, now: () => NOW })).seededSim).toBe(false);
  });

  it("a cell absent from the new rollup disappears (empty rollup still clears global real cells)", async () => {
    const f = fake([], {});
    f.tables.set("__global", [
      { level: "move", move: "poke", phase: "", archetype: "", source: "real", count: 1, n: 1, positives: 0, rewardSum: 0, rewardSq: 0 },
      { level: "move", move: "answer", phase: "", archetype: "", source: "sim", count: 1, n: 1, positives: 1, rewardSum: 1, rewardSq: 1 },
    ] as PriorTable);
    await runConversationLearn({ store: f.store, now: () => NOW });
    expect(f.upserts.some((u) => u.accountId === null && u.cells.length === 0)).toBe(true);
    expect(f.tables.get("__global")!.map((c) => c.source)).toEqual(["sim"]);
  });

  it("defers in-flight unsent decisions and excludes dead ones", async () => {
    const f = fake(
      [
        dec({ id: "q", sentAt: null, sentBody: null, sendStatus: "pending_review" }),
        dec({ id: "x", sentAt: null, sentBody: null, sendStatus: "canceled" }),
        dec({ id: "n", sentAt: null, sentBody: null, scheduledSendId: null, sendStatus: null }),
        dec({ id: "w", move: "wait", sentAt: null, sentBody: null, scheduledSendId: null, sendStatus: null }),
      ],
      {}
    );
    const r = await runConversationLearn({ store: f.store, now: () => NOW });
    expect(r).toMatchObject({ deferred: 1, excluded: 2, scored: 1 });
    expect(f.scored.find((s) => s.id === "q")).toBeUndefined();
    expect(f.scored.find((s) => s.id === "x")).toMatchObject({ reward: null, outcome: { unsent: true } });
  });

  it("a throwing decision is counted failed and the loop continues; rollup window is 90 days", async () => {
    const f = fake([dec({ id: "bad" }), dec({ id: "ok" })], {});
    const orig = f.store.outcomeFor;
    f.store.outcomeFor = async (d) => {
      if (d.id === "bad") throw new Error("boom");
      return orig(d);
    };
    const r = await runConversationLearn({ store: f.store, now: () => NOW });
    expect(r).toMatchObject({ failed: 1, scored: 1 });
    expect(f.since()!.getTime()).toBe(NOW.getTime() - 90 * 86_400_000);
  });
});
