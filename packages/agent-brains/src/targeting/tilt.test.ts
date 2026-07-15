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
