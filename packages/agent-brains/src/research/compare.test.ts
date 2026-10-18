import { describe, expect, it } from "vitest";
import { judgeDeliberator, meanSd } from "./compare";

describe("deliberator verdict rule", () => {
  it("stays when mean percent of oracle rises by 3 points and false promotions are zero", () => {
    const v = judgeDeliberator({ rulesPct: 90, deliberatorPct: 93, rulesGenerations: 30, deliberatorGenerations: 30, falsePromotions: 0 });
    expect(v.stay).toBe(true);
    expect(v.reason.startsWith("deliberator stays")).toBe(true);
  });

  it("stays when generations fall by 20% at an equal percent of oracle", () => {
    const v = judgeDeliberator({ rulesPct: 90, deliberatorPct: 90, rulesGenerations: 30, deliberatorGenerations: 24, falsePromotions: 0 });
    expect(v.stay).toBe(true);
  });

  it("rejects a smaller gain that is not also faster", () => {
    const v = judgeDeliberator({ rulesPct: 90, deliberatorPct: 92.9, rulesGenerations: 30, deliberatorGenerations: 28, falsePromotions: 0 });
    expect(v.stay).toBe(false);
    expect(v.reason.startsWith("deliberator rejected")).toBe(true);
  });

  it("rejects a faster run whose percent of oracle is worse", () => {
    const v = judgeDeliberator({ rulesPct: 90, deliberatorPct: 89, rulesGenerations: 30, deliberatorGenerations: 20, falsePromotions: 0 });
    expect(v.stay).toBe(false);
  });

  it("rejects any false promotion even when the oracle share rises", () => {
    const v = judgeDeliberator({ rulesPct: 90, deliberatorPct: 99, rulesGenerations: 30, deliberatorGenerations: 10, falsePromotions: 1 });
    expect(v.stay).toBe(false);
    expect(v.reason).toContain("false promotions 1");
  });

  it("reports a sample standard deviation", () => {
    expect(meanSd([2, 4]).sd).toBeCloseTo(Math.sqrt(2), 6);
  });
});
