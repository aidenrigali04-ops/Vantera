import { describe, expect, it } from "vitest";
import { applyIfCurrent, nextAfterRemoval } from "./peek-result";

describe("applyIfCurrent", () => {
  it("applies a result for the draft that is still open", () => {
    const result = { sendId: "d1", body: "new text", styleFlags: null };
    expect(applyIfCurrent("d1", result)).toBe(result);
  });

  it("drops a result whose draft is no longer open (moved on while regenerating)", () => {
    expect(applyIfCurrent("d2", { sendId: "d1", body: "stale" })).toBeNull();
  });

  it("drops a result when the peek has closed", () => {
    expect(applyIfCurrent(null, { sendId: "d1", body: "stale" })).toBeNull();
  });
});

describe("nextAfterRemoval", () => {
  const ids = ["a", "b", "c"];

  it("opens the next draft after the one that completed while it is still open", () => {
    expect(nextAfterRemoval(ids, "b", "b")).toEqual({ kind: "open", id: "c" });
  });

  it("falls back to the previous draft at the end of the list, and closes when it was the last one", () => {
    expect(nextAfterRemoval(ids, "c", "c")).toEqual({ kind: "open", id: "b" });
    expect(nextAfterRemoval(["a"], "a", "a")).toEqual({ kind: "close" });
  });

  it("does nothing when the owner already moved to another draft (or closed the peek)", () => {
    expect(nextAfterRemoval(ids, "a", "c")).toBeNull();
    expect(nextAfterRemoval(ids, "a", null)).toBeNull();
  });
});
