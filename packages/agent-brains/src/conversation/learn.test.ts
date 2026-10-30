import { describe, expect, it } from "vitest";
import { IPW_CLIP, REWARD, isPositive, reward, rollup, updateCell, type DecisionOutcome } from "./learn";
import type { PriorCell } from "./priors";

const out = (p: Partial<DecisionOutcome> = {}): DecisionOutcome => ({
  replied: false, stance: null, furtherLeadTurns: 0, booked: false, optOut: false,
  identitySuspicion: false, humanTakeover: false, waitThenReply: false, ...p,
});
const empty: PriorCell = { level: "move", move: "observe", phase: "", archetype: "", source: "real", count: 0, n: 0, positives: 0, rewardSum: 0, rewardSq: 0 };

describe("learn", () => {
  it("reward: meeting booked dominates (+10) and opt-out is −5; identity suspicion −4; wait followed by reply +1", () => {
    expect(REWARD.booked).toBe(10);
    expect(reward(out({ booked: true }), "propose_times")).toBe(10);
    expect(reward(out({ bookedShared: true }), "poke")).toBe(5);
    expect(reward(out({ optOut: true }), "poke")).toBe(-5);
    expect(reward(out({ identitySuspicion: true }), "observe")).toBe(-4);
    expect(reward(out({ waitThenReply: true }), "wait")).toBe(1);
    expect(reward(out({ waitThenReply: true }), "poke")).toBe(0);
    expect(reward(out({ replied: true, stance: "positive", furtherLeadTurns: 5 }), "observe")).toBe(1 + 2 + 3);
    expect(reward(out({ replied: true, stance: "negative" }), "observe")).toBe(1 - 2);
    expect(reward(out({ humanTakeover: true }), "observe")).toBe(0);
    expect(isPositive(0)).toBe(false);
    expect(isPositive(0.1)).toBe(true);
  });

  it("updateCell applies inverse-propensity weight clipped at 10", () => {
    const a = updateCell(empty, 2, 0.5);
    expect(a).toMatchObject({ count: 1, n: 2, positives: 2, rewardSum: 4, rewardSq: 8 });
    const b = updateCell(empty, -1, 0.01);
    expect(b).toMatchObject({ n: IPW_CLIP, positives: 0, rewardSum: -IPW_CLIP, rewardSq: IPW_CLIP });
    expect(updateCell(empty, 1, 0).n).toBe(1);
    expect(empty.n).toBe(0);
  });

  it("rollup produces move, move_phase and move_phase_archetype cells with consistent totals", () => {
    const A = "ic_mgr:low:low" as const;
    const t = rollup(
      [
        { move: "observe", phase: "pre_reply", archetype: A, propensity: 1, reward: 1 },
        { move: "observe", phase: "engaged", archetype: A, propensity: 0.5, reward: -1 },
      ],
      "sim",
    );
    expect(t.every((c) => c.source === "sim")).toBe(true);
    const lv = (l: string) => t.filter((c) => c.level === l);
    expect(lv("move")).toHaveLength(1);
    expect(lv("move_phase")).toHaveLength(2);
    expect(lv("move_phase_archetype")).toHaveLength(2);
    const sum = (cs: PriorCell[]) => cs.reduce((s, c) => s + c.n, 0);
    const cnt = (cs: PriorCell[]) => cs.reduce((s, c) => s + c.count, 0);
    expect(cnt(lv("move"))).toBe(2);
    expect(cnt(lv("move_phase"))).toBe(2);
    expect(cnt(lv("move_phase_archetype"))).toBe(2);
    expect(sum(lv("move"))).toBe(3);
    expect(sum(lv("move_phase"))).toBe(3);
    expect(sum(lv("move_phase_archetype"))).toBe(3);
    expect(lv("move")[0]).toMatchObject({ phase: "", archetype: "", positives: 1, rewardSum: -1 });
  });
});
