import { describe, expect, it } from "vitest";
import { assignVariant, leadBucket } from "./allocate";

describe("assignVariant", () => {
  const exp = { id: "exp-1", allocationPct: 25 };

  it("is deterministic and stable for a given lead", () => {
    const first = assignVariant(exp, "lead-abc");
    for (let i = 0; i < 50; i++) expect(assignVariant(exp, "lead-abc")).toBe(first);
  });

  it("routes roughly allocationPct of leads to the challenger over many leads", () => {
    let challenger = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (assignVariant(exp, `lead-${i}`) === "challenger") challenger++;
    const pct = (challenger / N) * 100;
    expect(pct).toBeGreaterThan(21);
    expect(pct).toBeLessThan(29);
  });

  it("routes everyone to champion at 0% and challenger at 100%", () => {
    expect(assignVariant({ id: "x", allocationPct: 0 }, "lead-1")).toBe("champion");
    expect(assignVariant({ id: "x", allocationPct: 100 }, "lead-1")).toBe("challenger");
  });

  it("clamps out-of-range and non-finite allocations safely", () => {
    expect(assignVariant({ id: "x", allocationPct: -10 }, "l")).toBe("champion");
    expect(assignVariant({ id: "x", allocationPct: 999 }, "l")).toBe("challenger");
    expect(assignVariant({ id: "x", allocationPct: Number.NaN }, "l")).toBe("champion");
  });

  it("keeps buckets within [0,100)", () => {
    for (let i = 0; i < 200; i++) {
      const b = leadBucket("exp", `lead-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });
});
