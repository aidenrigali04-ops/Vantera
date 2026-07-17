import { describe, expect, it } from "vitest";
import {
  seniorityBucket,
  buildTargetingProfile,
  targetingTilt,
  rankByTilt,
  topTiltSegment,
} from "./tilt";
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
const row = (title: string | null, industry: string | null, o: Partial<LeadOutcomeFlags>) => ({
  title,
  industry,
  flags: F(o),
});

// 10 founders in saas: 8 accepted, 6 interested. 10 managers in logistics: 2 accepted, 0 deep.
const ROWS = [
  ...Array.from({ length: 10 }, (_, i) =>
    row("Founder", "saas", { accepted: i < 8, interested: i < 6 })
  ),
  ...Array.from({ length: 10 }, (_, i) => row("Ops Manager", "logistics", { accepted: i < 2 })),
];

describe("seniorityBucket", () => {
  it("maps titles to buckets", () => {
    expect(seniorityBucket("Founder & CEO")).toBe("founder");
    expect(seniorityBucket("Co-Founder")).toBe("founder");
    expect(seniorityBucket("Chief Revenue Officer")).toBe("exec");
    expect(seniorityBucket("VP of Sales")).toBe("vp");
    expect(seniorityBucket("Sales Director")).toBe("director");
    expect(seniorityBucket("Head of Growth")).toBe("manager");
    expect(seniorityBucket("Marketing Manager")).toBe("manager");
    expect(seniorityBucket("Software Engineer")).toBe("other");
    expect(seniorityBucket(null)).toBe("other");
  });
});

describe("buildTargetingProfile / targetingTilt", () => {
  const profile = buildTargetingProfile(ROWS);

  it("aggregates baseline and segments from invited leads only", () => {
    expect(profile.baseline).toEqual({ n: 20, accepted: 10, deep: 6 });
    expect(profile.segments.get("seniority:founder")).toEqual({ n: 10, accepted: 8, deep: 6 });
    expect(profile.segments.get("industry:saas")).toEqual({ n: 10, accepted: 8, deep: 6 });
  });

  it("ignores never-invited leads", () => {
    const p = buildTargetingProfile([row("Founder", "saas", { invited: false })]);
    expect(p.baseline.n).toBe(0);
  });

  it("tilts founders up and managers down, clamped to ±5", () => {
    const up = targetingTilt({ title: "Founder", industry: "saas" }, profile);
    const down = targetingTilt({ title: "Ops Manager", industry: "logistics" }, profile);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThanOrEqual(5);
    expect(down).toBeLessThan(0);
    expect(down).toBeGreaterThanOrEqual(-5);
  });

  it("gives zero tilt below the sample floor and for unknown segments", () => {
    const thin = buildTargetingProfile(ROWS.slice(0, 5)); // n=5 < 8 floor
    expect(targetingTilt({ title: "Founder", industry: "saas" }, thin)).toBe(0);
    expect(targetingTilt({ title: "CTO", industry: "unseen" }, buildTargetingProfile(ROWS))).toBe(0);
  });
});

// ── EB shrinkage + max-not-sum (WS-1.4): SHRINK_M = 25, same pseudo-observation count as the ────
// bandit prior (bandit.ts), targeted at the ACCOUNT baseline instead of a pooled global rate.
describe("EB shrinkage toward the account baseline", () => {
  it("a 1-lucky-accept-in-8 segment (account baseline ~10%, n=40) earns < 1 point of tilt post-shrinkage", () => {
    const rows = [
      // segment under test: 8 invited "Ops Manager" leads (n = SEGMENT_FLOOR exactly) — only 1
      // lucky accept, which also happened to go deep. Pure small-sample noise, not real signal.
      ...Array.from({ length: 8 }, (_, i) =>
        row("Ops Manager", null, { accepted: i < 1, interested: i < 1 })
      ),
      // 32 filler leads hold the account baseline at accept=10%, deep=2.5% over n=40 total —
      // the "account baseline ~10%, n=40" fixture named in the task brief.
      ...Array.from({ length: 32 }, (_, i) => row("Staff Engineer", null, { accepted: i < 3 })),
    ];
    const profile = buildTargetingProfile(rows);
    expect(profile.baseline).toEqual({ n: 40, accepted: 4, deep: 1 });

    const tilt = targetingTilt({ title: "Ops Manager", industry: null }, profile);
    // MEASURED (this exact fixture, hand-computed against the pre-shrinkage sum-math): raw
    // accept delta clamp(0.25) + raw deep delta clamp(1.5) -> rounds to 1.8 pre-shrinkage — an
    // 8-sample segment swinging most of the way to the caps off a single coin-flip observation.
    // Post-shrinkage (M=25 toward the 10%/2.5% baseline) it earns 0.4 — under 1 point.
    expect(tilt).toBeLessThan(1);
    expect(tilt).toBe(0.4);
  });

  it("max-not-sum: a lead in two above-baseline segments gets the max contribution, not the sum", () => {
    const rows = [
      // seniority:founder segment — real, moderately above-baseline signal (n=10)
      ...Array.from({ length: 10 }, (_, i) =>
        row("Founder", "saas", { accepted: i < 5, interested: i < 4 })
      ),
      // industry:fintech segment — a real but WEAKER signal, different population (n=10)
      ...Array.from({ length: 10 }, (_, i) =>
        row("Ops Manager", "fintech", { accepted: i < 4, interested: i < 3 })
      ),
      // filler holding the account baseline (accept 40%, deep 25%, n=40 total) — a seniority
      // bucket absent from the assertions below, and chosen so NEITHER real segment's own
      // contribution saturates the ±5 outer cap (that would mask sum-vs-max under old code too).
      ...Array.from({ length: 20 }, (_, i) =>
        row("Director", null, { accepted: i < 7, interested: i < 3 })
      ),
    ];
    const profile = buildTargetingProfile(rows);
    expect(profile.baseline).toEqual({ n: 40, accepted: 16, deep: 10 }); // 40% / 25%

    // isolate each segment's own contribution via a candidate that only matches ONE key
    const founderOnly = targetingTilt({ title: "Founder", industry: null }, profile);
    const fintechOnly = targetingTilt({ title: "VP of Sales", industry: "fintech" }, profile);
    expect(founderOnly).toBeGreaterThan(0); // both are real, above-baseline segments —
    expect(fintechOnly).toBeGreaterThan(0); // the correlated-evidence case this guards against
    // MEASURED (this fixture, hand-computed pre-shrinkage sum-math): founderOnly=3.3,
    // fintechOnly=0.8, and the old sum path gave combined=4.0 (≠ max) — genuine double-counting,
    // not masked by outer-cap saturation.

    // a lead matching BOTH segments (founder in fintech) must take the max, never the sum
    const combined = targetingTilt({ title: "Founder", industry: "fintech" }, profile);
    expect(combined).toBe(Math.max(founderOnly, fintechOnly));
    expect(combined).toBeLessThan(founderOnly + fintechOnly); // the old (buggy) sum behavior
  });
});

describe("rankByTilt", () => {
  const profile = buildTargetingProfile(ROWS);

  it("lets a strong segment overtake a slightly higher raw score", () => {
    const a = { id: "a", title: "Ops Manager", industry: "logistics", aiScore: 82 };
    const b = { id: "b", title: "Founder", industry: "saas", aiScore: 80 };
    expect(rankByTilt([a, b], profile).map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("is pure score order with an empty profile (inert without data)", () => {
    const empty = buildTargetingProfile([]);
    const a = { id: "a", title: "Founder", industry: "saas", aiScore: 75 };
    const b = { id: "b", title: "Ops Manager", industry: "x", aiScore: 90 };
    expect(rankByTilt([a, b], empty).map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("never lets the tilt overcome a large score gap (bounded ±5)", () => {
    const a = { id: "a", title: "Ops Manager", industry: "logistics", aiScore: 95 };
    const b = { id: "b", title: "Founder", industry: "saas", aiScore: 80 };
    expect(rankByTilt([a, b], profile).map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("topTiltSegment", () => {
  it("returns the strongest floor-passing above-baseline segment", () => {
    const top = topTiltSegment(buildTargetingProfile(ROWS));
    expect(top).not.toBeNull();
    expect(top!.key).toMatch(/founder|saas/);
    expect(top!.stat.n).toBe(10);
  });

  it("returns null when data is thin", () => {
    expect(topTiltSegment(buildTargetingProfile([]))).toBeNull();
    expect(topTiltSegment(buildTargetingProfile(ROWS.slice(0, 5)))).toBeNull();
  });

  it("never surfaces the unclassifiable 'other' bucket as the UI focus", () => {
    // 10 unclassifiable titles converting above 10 founders — tilt math may use it, the UI must not
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        row("Ninja of Vibes", null, { accepted: i < 8, interested: i < 6 })
      ),
      ...Array.from({ length: 10 }, (_, i) => row("Founder", null, { accepted: i < 2 })),
    ];
    expect(topTiltSegment(buildTargetingProfile(rows))?.key).not.toBe("seniority:other");
  });
});
