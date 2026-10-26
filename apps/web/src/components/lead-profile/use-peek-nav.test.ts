import { describe, expect, it } from "vitest";
import { peekNav } from "./use-peek-nav";

describe("peekNav", () => {
  const ids = ["a", "b", "c"];

  it("first row: no prev, next is the second", () => {
    expect(peekNav(ids, "a")).toEqual({ index: 0, total: 3, prevId: null, nextId: "b" });
  });

  it("last row: prev is the second-to-last, no next", () => {
    expect(peekNav(ids, "c")).toEqual({ index: 2, total: 3, prevId: "b", nextId: null });
  });

  it("middle row: both neighbours", () => {
    expect(peekNav(ids, "b")).toEqual({ index: 1, total: 3, prevId: "a", nextId: "c" });
  });

  it("unknown or no id: index -1 and no neighbours", () => {
    expect(peekNav(ids, "zzz")).toEqual({ index: -1, total: 3, prevId: null, nextId: null });
    expect(peekNav(ids, null)).toEqual({ index: -1, total: 3, prevId: null, nextId: null });
  });
});
