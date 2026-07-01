import { describe, expect, it } from "vitest";
import { computeOutreachFunnel, wilsonInterval, MIN_STAGE_SAMPLE } from "./funnel";

describe("wilsonInterval", () => {
  it("returns 0..0 for an empty denominator", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
  });

  it("brackets the point estimate and narrows as the sample grows", () => {
    const wide = wilsonInterval(5, 10); // 50% over 10
    const narrow = wilsonInterval(50, 100); // 50% over 100
    expect(wide.low).toBeLessThan(50);
    expect(wide.high).toBeGreaterThan(50);
    expect(narrow.high - narrow.low).toBeLessThan(wide.high - wide.low);
  });

  it("stays within [0,100] at the extremes", () => {
    const ci = wilsonInterval(1, 1);
    expect(ci.low).toBeGreaterThanOrEqual(0);
    expect(ci.high).toBeLessThanOrEqual(100);
  });
});

describe("computeOutreachFunnel", () => {
  it("converts each stage from the correct denominator", () => {
    const byKey = Object.fromEntries(
      computeOutreachFunnel({ invited: 100, accepted: 40, interestedReplies: 8, booked: 3, closed: 1 }).map(
        (s) => [s.key, s]
      )
    );
    expect(byKey.acceptance!.ratePct).toBe(40); // 40/100
    expect(byKey.reply!.ratePct).toBe(20); // 8/40
    expect(byKey.booking!.ratePct).toBeCloseTo(37.5, 1); // 3/8
    expect(byKey.close!.ratePct).toBeCloseTo(33.3, 1); // 1/3
  });

  it("marks a stage below the minimum sample as not enough data", () => {
    const [acceptance] = computeOutreachFunnel({
      invited: MIN_STAGE_SAMPLE - 1,
      accepted: 5,
      interestedReplies: 0,
      booked: 0,
      closed: 0,
    });
    expect(acceptance!.enoughData).toBe(false);
  });

  it("returns null rate/ci when there is nothing to convert", () => {
    const [acceptance] = computeOutreachFunnel({
      invited: 0,
      accepted: 0,
      interestedReplies: 0,
      booked: 0,
      closed: 0,
    });
    expect(acceptance!.ratePct).toBeNull();
    expect(acceptance!.ci).toBeNull();
  });

  it("flags a rate below the typical band", () => {
    const [acceptance] = computeOutreachFunnel({
      invited: 100,
      accepted: 10,
      interestedReplies: 2,
      booked: 1,
      closed: 0,
    });
    expect(acceptance!.benchmark!.status).toBe("below"); // 10% < 25
  });

  it("never reports a rate above 100% even on inconsistent data", () => {
    const [, reply] = computeOutreachFunnel({
      invited: 10,
      accepted: 4,
      interestedReplies: 6, // more interested than accepted (data edge)
      booked: 0,
      closed: 0,
    });
    expect(reply!.ratePct).toBe(100);
  });
});
