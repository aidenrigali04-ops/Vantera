import { describe, expect, it } from "vitest";
import { chargeFacts, fmtChargeDate, paybackLine, planFacts, usd } from "./plan-facts";

const NOW = new Date("2026-08-22T12:00:00Z");

describe("planFacts", () => {
  it("reads the single self-serve plan from the billing package, never a typed-in price", () => {
    const p = planFacts();
    expect(p.monthlyUsd).toBeGreaterThan(0);
    expect(p.annualYearlyUsd).toBe(p.monthlyUsd * 10); // two months free
    expect(p.monthsFree).toBe(2);
    expect(p.trialDays).toBeGreaterThan(0);
    expect(p.features.length).toBeGreaterThan(0);
  });
});

describe("chargeFacts", () => {
  it("is always $0 today, and names the exact date money moves", () => {
    const p = planFacts();
    const c = chargeFacts(p, "month", NOW);
    expect(c.todayUsd).toBe(0);
    expect(c.thenUsd).toBe(p.monthlyUsd);
    expect(c.thenUnit).toBe("/mo");
    // 7-day trial from Aug 22 → charges Aug 29, cancel free through Aug 28
    expect(c.firstChargeLabel).toBe("Aug 29");
    expect(c.cancelByLabel).toBe("Aug 28");
  });

  it("annual charges the yearly total, not the effective monthly", () => {
    const p = planFacts();
    const c = chargeFacts(p, "year", NOW);
    expect(c.thenUsd).toBe(p.annualYearlyUsd);
    expect(c.thenUnit).toBe("/yr");
  });

  it("crosses months and years correctly", () => {
    expect(fmtChargeDate(new Date("2026-12-31T00:00:00"))).toBe("Dec 31");
    expect(fmtChargeDate(new Date("2027-01-01T00:00:00"))).toBe("Jan 1");
  });
});

describe("paybackLine", () => {
  it("says nothing when we don't know what a client is worth — never invents a number", () => {
    expect(paybackLine(planFacts(), "month", null)).toBeNull();
    expect(paybackLine(planFacts(), "month", 0)).toBeNull();
  });

  it("anchors the price against one closed client when the deal value covers a year", () => {
    const p = planFacts();
    expect(paybackLine(p, "month", p.monthlyUsd * 18)).toBe("One closed client covers 18 months.");
    expect(paybackLine(p, "month", p.monthlyUsd * 300)).toBe("One closed client covers you for two years.");
  });

  it("quotes the unit the user is buying — never a month count beside an annual price", () => {
    const p = planFacts();
    expect(paybackLine(p, "year", p.monthlyUsd * 18)).toBe("One closed client covers the whole year.");
  });

  it("counts the closes honestly when one is not enough", () => {
    const p = planFacts();
    expect(paybackLine(p, "month", p.monthlyUsd)).toBe("12 closed clients cover the year.");
  });
});

describe("usd", () => {
  it("is whole dollars with separators", () => {
    expect(usd(79)).toBe("$79");
    expect(usd(790)).toBe("$790");
    expect(usd(1204)).toBe("$1,204");
  });
});
