import { describe, expect, it } from "vitest";
import { findMissingWhyNow, pickWhyNow, WHY_NOW_MAX_AGE_DAYS } from "./why-now";

const NOW = new Date("2026-10-21T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("pickWhyNow", () => {
  it("prefers a buying-intent signal over company events", () => {
    const w = pickWhyNow(
      [
        { kind: "funding", label: "Raised a $12M Series A", detail: "Series A", observedAt: daysAgo(10) },
        { kind: "intent", label: "Commented asking for a churn tool on a RevOps post", detail: "x", observedAt: daysAgo(2) },
      ],
      NOW
    );
    expect(w).toEqual({ kind: "intent", text: "Commented asking for a churn tool on a RevOps post", ageDays: 2 });
  });

  it("falls back to the strongest fresh company event, using detail when there is no label", () => {
    const w = pickWhyNow(
      [
        { kind: "hiring", label: null, detail: "Hiring 4 SDRs", observedAt: daysAgo(5) },
        { kind: "exec_hire", label: null, detail: "New VP Sales joined", observedAt: daysAgo(20) },
      ],
      NOW
    );
    expect(w?.kind).toBe("exec_hire");
    expect(w?.text).toBe("New VP Sales joined");
  });

  it("treats a new follow as a reason to reach out, below explicit intent but above company news (ML-8)", () => {
    const w = pickWhyNow(
      [
        { kind: "funding", label: "Raised a round", detail: "x", observedAt: daysAgo(3) },
        { kind: "follow", label: "Started following you on LinkedIn", detail: null, observedAt: daysAgo(1) },
      ],
      NOW
    );
    expect(w?.kind).toBe("follow");
    expect(findMissingWhyNow("Thanks for the follow, Dana!", { kind: "follow", text: "Started following you on LinkedIn" })).toEqual([]);
    expect(findMissingWhyNow("Dana, great to connect.", { kind: "follow", text: "Started following you on LinkedIn" })).toHaveLength(1);
  });

  it("ignores stale or undated signals — an old event is not a why-now", () => {
    expect(pickWhyNow([{ kind: "funding", label: "Raised", detail: "x", observedAt: daysAgo(WHY_NOW_MAX_AGE_DAYS + 1) }], NOW)).toBeNull();
    expect(pickWhyNow([{ kind: "funding", label: "Raised", detail: "x", observedAt: null }], NOW)).toBeNull();
  });

  it("ignores signal kinds that aren't a reason to reach out", () => {
    expect(pickWhyNow([{ kind: "legal", label: "Lawsuit filed", detail: "x", observedAt: daysAgo(3) }], NOW)).toBeNull();
    expect(pickWhyNow([{ kind: "cost_cutting", label: "Layoffs", detail: "x", observedAt: daysAgo(3) }], NOW)).toBeNull();
  });
});

describe("findMissingWhyNow", () => {
  const intent = { kind: "intent", text: "Commented asking for a churn tool on a RevOps post" };

  it("passes when the note references the moment in its own words", () => {
    expect(findMissingWhyNow("Saw your comment about onboarding churn tools, curious what you landed on.", intent)).toEqual([]);
    expect(findMissingWhyNow("Congrats on the Series A raise!", { kind: "funding", text: "Raised a $12M Series A" })).toEqual([]);
    expect(findMissingWhyNow("Welcome aboard as VP Sales at Globex.", { kind: "exec_hire", text: "New VP Sales joined Globex" })).toEqual([]);
  });

  it("flags a note that ignores the why-now", () => {
    const v = findMissingWhyNow("Hi Gwen, always great to connect with CX leaders.", intent);
    expect(v).toHaveLength(1);
    expect(v[0]!.rule).toBe("why-now-missing");
    expect(v[0]!.detail).toContain("churn tool");
  });

  it("checks nothing when there is no why-now", () => {
    expect(findMissingWhyNow("Hi, great to connect.", null)).toEqual([]);
  });
});

describe("findMissingWhyNow — identity words don't count as a citation", () => {
  it("does not accept a note that only shares the prospect's company/name words with the signal", () => {
    const why = { kind: "funding", text: "Harborline Talent Partners raised a Series A to expand its client roster" };
    const v = findMissingWhyNow("Anaya, great to connect with talent leaders.", why, "Anaya Shah Harborline Talent Partners");
    expect(v.map((x) => x.rule)).toEqual(["why-now-missing"]);
    expect(findMissingWhyNow("Anaya, congrats on the Series A!", why, "Anaya Shah Harborline Talent Partners")).toEqual([]);
  });
});
