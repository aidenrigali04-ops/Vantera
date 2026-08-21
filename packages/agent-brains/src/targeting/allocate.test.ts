import { describe, expect, it } from "vitest";
import { allocateDiscovery } from "./allocate";
import type { LeadOutcomeFlags } from "../optimize/outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: true,
  accepted: false,
  interested: false,
  negative: false,
  booked: false,
  converted: false,
  ...o,
});

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
}

describe("allocateDiscovery", () => {
  it("splits equally with no outcome data (inert without data)", () => {
    const out = allocateDiscovery(
      30,
      [
        { id: "a", flags: [] },
        { id: "b", flags: [] },
        { id: "c", flags: [] },
      ],
      lcg(1)
    );
    expect([...out.values()]).toEqual([10, 10, 10]);
  });

  it("gives a single ICP the whole target", () => {
    expect(allocateDiscovery(30, [{ id: "a", flags: [] }], lcg(1)).get("a")).toBe(30);
  });

  it("returns an empty map for target <= 0 or no ICPs", () => {
    expect(allocateDiscovery(0, [{ id: "a", flags: [] }], lcg(1)).size).toBe(0);
    expect(allocateDiscovery(10, [], lcg(1)).size).toBe(0);
  });

  it("tilts quota toward the converting ICP while every ICP keeps its exploration floor", () => {
    const strong = Array.from({ length: 30 }, (_, i) => F({ accepted: true, interested: i < 15 }));
    const weak = Array.from({ length: 30 }, () => F({ accepted: true }));
    const rand = lcg(42);
    let strongTotal = 0;
    let weakMin = Infinity;
    for (let i = 0; i < 50; i++) {
      const out = allocateDiscovery(
        30,
        [
          { id: "s", flags: strong },
          { id: "w", flags: weak },
        ],
        rand
      );
      strongTotal += out.get("s") ?? 0;
      weakMin = Math.min(weakMin, out.get("w") ?? 0);
      expect((out.get("s") ?? 0) + (out.get("w") ?? 0)).toBe(30);
    }
    expect(strongTotal / 50).toBeGreaterThan(18); // clearly above the equal share of 15
    expect(weakMin).toBeGreaterThanOrEqual(6); // 40% exploration floor / 2 ICPs = 6
  });
});
