import { describe, expect, it } from "vitest";
import { mergePendingTurns } from "./conversation-merge";
import type { ThreadTurn } from "@/lib/conversations";

const turn = (over: Partial<ThreadTurn>): ThreadTurn => ({
  role: "agent",
  text: "hello",
  at: "2026-07-15T10:00:00Z",
  playLabel: null,
  classification: null,
  manual: false,
  ...over,
});

describe("mergePendingTurns", () => {
  it("returns turns untouched with no pending sends", () => {
    const turns = [turn({})];
    expect(mergePendingTurns(turns, [])).toBe(turns);
  });

  it("appends a pending send as a manual agent bubble marked pending", () => {
    const merged = mergePendingTurns([turn({})], [{ text: "on its way", at: "2026-07-15T11:00:00Z" }]);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({ role: "agent", manual: true, pending: true, text: "on its way" });
  });

  it("drops a pending send once the server thread includes the same text (no double bubble)", () => {
    const merged = mergePendingTurns(
      [turn({ text: "on its way", manual: true })],
      [{ text: "on its way", at: "2026-07-15T11:00:00Z" }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].pending).toBeUndefined();
  });

  it("only dedupes against agent-side turns — a lead echoing the words doesn't swallow the send", () => {
    const merged = mergePendingTurns(
      [turn({ role: "lead", text: "on its way" })],
      [{ text: "on its way", at: "2026-07-15T11:00:00Z" }]
    );
    expect(merged).toHaveLength(2);
  });

  it("ignores blank pending entries", () => {
    expect(mergePendingTurns([], [{ text: "   ", at: "2026-07-15T11:00:00Z" }])).toHaveLength(0);
  });
});
