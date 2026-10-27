import { describe, expect, it } from "vitest";
import { reconcileRemoved, resolveOpenDraft } from "./queue-nav";

const ids = ["a", "b", "c", "d"];

describe("resolveOpenDraft", () => {
  it("auto-opens the first row when ?draft is absent", () => {
    expect(resolveOpenDraft(ids, null)).toBe("a");
    expect(resolveOpenDraft(ids, undefined)).toBe("a");
    expect(resolveOpenDraft(ids, "")).toBe("a");
  });

  it("gives ?draft precedence when it is in the list", () => {
    expect(resolveOpenDraft(ids, "c")).toBe("c");
  });

  it("falls back to the first row when ?draft is unknown (stale deep link)", () => {
    expect(resolveOpenDraft(ids, "zzz")).toBe("a");
  });

  it("returns null for an empty queue", () => {
    expect(resolveOpenDraft([], null)).toBeNull();
    expect(resolveOpenDraft([], "a")).toBeNull();
  });

  it("after removal of the open draft, opens the next one", () => {
    expect(resolveOpenDraft(ids, "b", new Set(["b"]))).toBe("c");
  });

  it("skips over other removed rows when finding the next one", () => {
    expect(resolveOpenDraft(ids, "b", new Set(["b", "c"]))).toBe("d");
  });

  it("after removal of the last row, opens the previous one", () => {
    expect(resolveOpenDraft(ids, "d", new Set(["d"]))).toBe("c");
  });

  it("returns null when every row was removed", () => {
    expect(resolveOpenDraft(ids, "a", new Set(ids))).toBeNull();
  });

  it("a removed row never auto-opens as the first row", () => {
    expect(resolveOpenDraft(ids, null, new Set(["a"]))).toBe("b");
  });
});

describe("reconcileRemoved", () => {
  it("drops ids the revalidated rows no longer contain", () => {
    expect([...reconcileRemoved(new Set(["a", "x"]), ["a", "b"])]).toEqual(["a"]);
  });

  it("returns an empty set when none are present", () => {
    expect(reconcileRemoved(new Set(["x", "y"]), ["a"]).size).toBe(0);
  });

  it("keeps ids still present (the server has not caught up yet)", () => {
    const out = reconcileRemoved(new Set(["a", "b"]), ["a", "b", "c"]);
    expect([...out].sort()).toEqual(["a", "b"]);
  });

  it("returns a new set, never mutating the input", () => {
    const input = new Set(["a", "x"]);
    const out = reconcileRemoved(input, ["a"]);
    expect(out).not.toBe(input);
    expect(input.size).toBe(2);
  });
});
