import { describe, expect, it } from "vitest";
import type { PriorCell } from "@vantera/agent-brains";
import { mergePriorTables, turnsFromRows } from "./conversation-store-pure";

const cell = (over: Partial<PriorCell>): PriorCell => ({
  level: "move",
  move: "answer",
  phase: "",
  archetype: "",
  source: "real",
  count: 1,
  n: 1,
  positives: 0,
  rewardSum: 0,
  rewardSq: 0,
  ...over,
});

describe("turnsFromRows", () => {
  it("merges the three sources oldest-first and maps roles, refs and stages", () => {
    const turns = turnsFromRows(
      [
        { id: "s2", body: "follow-up", stage: "message", at: new Date("2026-01-03T00:00:00Z") },
        { id: "s1", body: "invite note", stage: "invite", at: new Date("2026-01-01T00:00:00Z") },
      ],
      [{ id: "n1", body: "human typed", at: new Date("2026-01-04T00:00:00Z") }],
      [{ id: "r1", body: "sure, tell me more", at: new Date("2026-01-02T00:00:00Z") }]
    );
    expect(turns.map((t) => t.ref)).toEqual(["s1", "r1", "s2", "n1"]);
    expect(turns.map((t) => t.role)).toEqual(["agent", "lead", "agent", "human"]);
    expect(turns[0]).toMatchObject({ stage: "invite", text: "invite note", at: "2026-01-01T00:00:00.000Z" });
    expect(turns[1]!.stage).toBeUndefined();
  });

  it("treats null bodies as empty text and is stable on ties", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const turns = turnsFromRows([{ id: "s", body: "a", stage: "invite", at }], [], [{ id: "r", body: null, at }]);
    expect(turns.map((t) => t.ref)).toEqual(["s", "r"]);
    expect(turns[1]!.text).toBe("");
  });
});

describe("mergePriorTables", () => {
  it("keeps account rows ahead of global rows", () => {
    const a = cell({ move: "poke" });
    const g = cell({ move: "answer", source: "research" });
    expect(mergePriorTables([a], [g])).toEqual([a, g]);
  });
});
