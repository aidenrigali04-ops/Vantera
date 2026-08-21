# Stage 2 — Targeting That Learns From Who Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-derive ICP emphasis from real funnel outcomes (accepts → interested replies → bookings) and tilt sourcing toward the buyers who actually convert — the spec's "biggest compounding payoff, slower signal" stage.

**Architecture:** Two bounded tilts, both derived at read time (no new tables, Stage 0.5/1 pattern), both ordering/allocation-only — the qualification gate (score ≥ 70), send volume, and safety limits are untouched:
1. **Discovery allocation across ICPs** (`scout.ts`): the per-run discovery quota, today an equal split, becomes 40% equal (exploration floor — no ICP ever starves) + 60% Thompson-proportional on each ICP's deep-conversion evidence (interested-or-booked among invited). One ICP or zero outcome data ⇒ byte-identical equal split.
2. **Qualified-pool drain ordering** (`getTopQualifiedLeadIds`): the best-first draft drain, today pure `ai_score` order, adds a bounded segment tilt (±5 points) from the account's own outcome profile — seniority bucket × industry, with an n≥8 sample floor per segment so thin data tilts nothing.

Visibility: a "prioritizing" line in the What's-working panel with the real segment numbers behind it — shown only when a segment actually passes the floor.

**Tech Stack:** Pure brains modules (`targeting/`), `sampleBeta` reused from the Stage-1b bandit, drizzle reads in pg-store only, RLS reads in `lib/optimize.ts`.

## Global Constraints

- **Gate never bypassed:** tilts reorder and allocate; they never qualify, never raise `discoveryTarget`/`draftBudget`, never touch send caps (same principle as "intent is a 2nd filter, never a bypass").
- **No new autonomy outside the envelope:** everything here is which-first / how-many-per-ICP, inside the same totals.
- **Derived, never stored:** profiles computed at read time from leads + replies. No migration.
- **Honest UI:** the panel line renders only with a floor-passing segment, showing real counts. No invented numbers.
- **Inert without data:** zero invited leads ⇒ both tilts are no-ops identical to today — guarded by tests.
- **Rule 13:** brains pure; RNG injected for the allocator.
- **Knowledge-sync (rule 09):** update `optimization.md`.
- **Gate:** full `pnpm lint && type-check && test && build` before merge; ship ends with promote + prod verification.

---

### Task 1: Outcome profile + segment tilt (brains, pure)

**Files:**
- Create: `packages/agent-brains/src/targeting/tilt.ts`
- Test: `packages/agent-brains/src/targeting/tilt.test.ts`
- Modify: `packages/agent-brains/src/index.ts`

**Interfaces (produces):**
```ts
export type TargetingRow = { title: string | null; industry: string | null; flags: LeadOutcomeFlags };
export function seniorityBucket(title: string | null): "founder" | "exec" | "vp" | "director" | "manager" | "other";
export type SegmentStat = { n: number; accepted: number; deep: number }; // n = invited
export interface TargetingProfile {
  baseline: SegmentStat;
  segments: Map<string, SegmentStat>; // keys "seniority:<bucket>" | "industry:<lowercased>"
}
export function buildTargetingProfile(rows: TargetingRow[]): TargetingProfile;
export function targetingTilt(lead: { title: string | null; industry: string | null }, profile: TargetingProfile): number; // clamped [-5, 5], 0 when floors unmet
export function rankByTilt<T extends { title: string | null; industry: string | null; aiScore: number | null }>(candidates: T[], profile: TargetingProfile): T[];
export const SEGMENT_FLOOR = 8;
export function topTiltSegment(profile: TargetingProfile): { key: string; label: string; stat: SegmentStat; baseline: SegmentStat } | null; // best floor-passing above-baseline segment for the UI, null when none
```

- [ ] **Step 1: Failing tests** — seniorityBucket keyword mapping (founder/CEO→founder, CRO/CMO/chief→exec, VP→vp, director→director, manager/head of→manager, null/eng→other); profile aggregation (n counts invited only); tilt: segment above baseline with n≥8 → positive, below → negative, n<8 → 0 contribution, clamp at ±5; rankByTilt reorders a lower-score lead above a higher one only when the tilt difference justifies it and preserves pure-score order for an empty profile; topTiltSegment returns null on thin data, the strongest qualifying segment otherwise.

Write the actual test file with concrete fixtures:

```ts
import { describe, expect, it } from "vitest";
import {
  seniorityBucket, buildTargetingProfile, targetingTilt, rankByTilt, topTiltSegment,
} from "./tilt";
import type { LeadOutcomeFlags } from "../optimize/outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: true, accepted: false, interested: false, negative: false, booked: false, converted: false, ...o,
});
const row = (title: string | null, industry: string | null, o: Partial<LeadOutcomeFlags>) =>
  ({ title, industry, flags: F(o) });

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
  // 10 founders: 8 accepted, 6 deep. 10 managers: 2 accepted, 0 deep. Baseline: 20 invited, 10 accepted, 6 deep.
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => row("Founder", "saas", { accepted: i < 8, interested: i < 6 })),
    ...Array.from({ length: 10 }, (_, i) => row("Ops Manager", "logistics", { accepted: i < 2 })),
  ];
  const profile = buildTargetingProfile(rows);

  it("aggregates baseline and segments from invited leads only", () => {
    expect(profile.baseline).toEqual({ n: 20, accepted: 10, deep: 6 });
    expect(profile.segments.get("seniority:founder")).toEqual({ n: 10, accepted: 8, deep: 6 });
    expect(profile.segments.get("industry:saas")).toEqual({ n: 10, accepted: 8, deep: 6 });
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
    const thin = buildTargetingProfile(rows.slice(0, 5)); // n=5 < 8
    expect(targetingTilt({ title: "Founder", industry: "saas" }, thin)).toBe(0);
    expect(targetingTilt({ title: "CTO", industry: "unseen" }, profile)).toBe(0);
  });
});

describe("rankByTilt", () => {
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => row("Founder", "saas", { accepted: i < 8, interested: i < 6 })),
    ...Array.from({ length: 10 }, (_, i) => row("Ops Manager", "logistics", { accepted: i < 2 })),
  ];
  const profile = buildTargetingProfile(rows);

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
});

describe("topTiltSegment", () => {
  it("returns the strongest floor-passing above-baseline segment, null when thin", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row("Founder", "saas", { accepted: i < 8, interested: i < 6 })),
      ...Array.from({ length: 10 }, (_, i) => row("Ops Manager", "logistics", { accepted: i < 2 })),
    ];
    const top = topTiltSegment(buildTargetingProfile(rows));
    expect(top?.key).toMatch(/founder|saas/);
    expect(topTiltSegment(buildTargetingProfile([]))).toBeNull();
  });
});
```

- [ ] **Step 2: Verify FAIL** — `npx vitest run src/targeting/tilt.test.ts` → module missing.

- [ ] **Step 3: Implement `targeting/tilt.ts`**

```ts
import type { LeadOutcomeFlags } from "../optimize/outcomes";

/**
 * Stage 2 targeting profile (spec 2026-07-14): learn WHO actually converts from the account's own
 * funnel outcomes and tilt the draft-drain ordering toward them. Derived at read time, bounded
 * (±TILT_CAP points on top of ai_score), floor-gated (a segment tilts nothing until it has real
 * sample), and ordering-only — the qualification gate and all volume caps are untouched. Pure.
 */

export type TargetingRow = { title: string | null; industry: string | null; flags: LeadOutcomeFlags };
export type SegmentStat = { n: number; accepted: number; deep: number };
export interface TargetingProfile {
  baseline: SegmentStat;
  segments: Map<string, SegmentStat>;
}

/** A segment needs this many INVITED leads before it may tilt anything. */
export const SEGMENT_FLOOR = 8;
const TILT_CAP = 5;
const ACCEPT_POINTS = 10; // rate-delta → points scale (capped per component below)
const DEEP_POINTS = 15;
const ACCEPT_CAP = 2;
const DEEP_CAP = 3;

const BUCKETS: [RegExp, "founder" | "exec" | "vp" | "director" | "manager"][] = [
  [/founder|co-?founder|\bceo\b|owner/i, "founder"],
  [/chief|\bc[a-z]o\b|president/i, "exec"],
  [/vice president|\bvp\b|\bsvp\b|\bevp\b/i, "vp"],
  [/director/i, "director"],
  [/manager|head of|lead\b/i, "manager"],
];

export function seniorityBucket(
  title: string | null
): "founder" | "exec" | "vp" | "director" | "manager" | "other" {
  if (!title) return "other";
  for (const [re, bucket] of BUCKETS) if (re.test(title)) return bucket;
  return "other";
}

function segmentKeys(lead: { title: string | null; industry: string | null }): string[] {
  const keys = [`seniority:${seniorityBucket(lead.title)}`];
  const ind = lead.industry?.trim().toLowerCase();
  if (ind) keys.push(`industry:${ind}`);
  return keys;
}

const EMPTY: SegmentStat = { n: 0, accepted: 0, deep: 0 };

export function buildTargetingProfile(rows: TargetingRow[]): TargetingProfile {
  const baseline = { ...EMPTY };
  const segments = new Map<string, SegmentStat>();
  for (const r of rows) {
    if (!r.flags.invited) continue;
    const deep = r.flags.interested || r.flags.booked;
    baseline.n++;
    if (r.flags.accepted) baseline.accepted++;
    if (deep) baseline.deep++;
    for (const key of segmentKeys(r)) {
      const s = segments.get(key) ?? { ...EMPTY };
      s.n++;
      if (r.flags.accepted) s.accepted++;
      if (deep) s.deep++;
      segments.set(key, s);
    }
  }
  return { baseline, segments };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function targetingTilt(
  lead: { title: string | null; industry: string | null },
  profile: TargetingProfile
): number {
  if (profile.baseline.n < SEGMENT_FLOOR) return 0;
  const baseAccept = profile.baseline.accepted / profile.baseline.n;
  const baseDeep = profile.baseline.deep / profile.baseline.n;
  let tilt = 0;
  for (const key of segmentKeys(lead)) {
    const s = profile.segments.get(key);
    if (!s || s.n < SEGMENT_FLOOR) continue;
    tilt += clamp((s.accepted / s.n - baseAccept) * ACCEPT_POINTS, -ACCEPT_CAP, ACCEPT_CAP);
    tilt += clamp((s.deep / s.n - baseDeep) * DEEP_POINTS, -DEEP_CAP, DEEP_CAP);
  }
  return clamp(Math.round(tilt * 10) / 10, -TILT_CAP, TILT_CAP);
}

/** Best-first drain ordering with the bounded tilt applied — ordering ONLY, never a gate. */
export function rankByTilt<
  T extends { title: string | null; industry: string | null; aiScore: number | null },
>(candidates: T[], profile: TargetingProfile): T[] {
  return [...candidates].sort(
    (a, b) =>
      (b.aiScore ?? 0) + targetingTilt(b, profile) - ((a.aiScore ?? 0) + targetingTilt(a, profile))
  );
}

const BUCKET_LABEL: Record<string, string> = {
  founder: "founders",
  exec: "C-level executives",
  vp: "VPs",
  director: "directors",
  manager: "managers",
  other: "other roles",
};

/** The strongest floor-passing, above-baseline segment — the honest UI line's data. Null when none. */
export function topTiltSegment(profile: TargetingProfile): {
  key: string;
  label: string;
  stat: SegmentStat;
  baseline: SegmentStat;
} | null {
  if (profile.baseline.n < SEGMENT_FLOOR) return null;
  let best: { key: string; stat: SegmentStat; score: number } | null = null;
  for (const [key, stat] of profile.segments) {
    if (stat.n < SEGMENT_FLOOR) continue;
    const score =
      stat.deep / stat.n - profile.baseline.deep / profile.baseline.n ||
      stat.accepted / stat.n - profile.baseline.accepted / profile.baseline.n;
    if (score > 0 && (!best || score > best.score)) best = { key, stat, score };
  }
  if (!best) return null;
  const [kind, value] = best.key.split(":") as [string, string];
  const label = kind === "seniority" ? (BUCKET_LABEL[value] ?? value) : `${value} buyers`;
  return { key: best.key, label, stat: best.stat, baseline: profile.baseline };
}
```

- [ ] **Step 4: Export from index, run** — export all of the above; `npx vitest run` in agent-brains → PASS incl. purity.

- [ ] **Step 5: Commit** — `feat(brains): outcome-derived targeting profile + bounded drain tilt (Stage 2)`

---

### Task 2: Thompson discovery allocation across ICPs (brains, pure)

**Files:**
- Create: `packages/agent-brains/src/targeting/allocate.ts` (+ test)
- Modify: `packages/agent-brains/src/optimize/bandit.ts` (export `sampleBeta`)
- Modify: `packages/agent-brains/src/index.ts`

**Interfaces (produces):**
```ts
export function allocateDiscovery(
  target: number,
  icps: { id: string; flags: LeadOutcomeFlags[] }[],
  rand: () => number
): Map<string, number>; // icpId → quota; sums to ~target, each ICP ≥ its exploration floor
```

- [ ] **Step 1: Failing tests** — equal split for 1 ICP / zero data / target 0 edge; with strong evidence for one ICP, its quota exceeds equal share while every ICP keeps ≥ floor (seeded LCG); quotas sum to target (±rounding); floor = 40% of target split equally (min 1 per ICP when target ≥ n).

```ts
import { describe, expect, it } from "vitest";
import { allocateDiscovery } from "./allocate";
import type { LeadOutcomeFlags } from "../optimize/outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: true, accepted: false, interested: false, negative: false, booked: false, converted: false, ...o,
});
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
}

describe("allocateDiscovery", () => {
  it("splits equally with no outcome data (inert without data)", () => {
    const out = allocateDiscovery(30, [{ id: "a", flags: [] }, { id: "b", flags: [] }, { id: "c", flags: [] }], lcg(1));
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
      const out = allocateDiscovery(30, [{ id: "s", flags: strong }, { id: "w", flags: weak }], rand);
      strongTotal += out.get("s") ?? 0;
      weakMin = Math.min(weakMin, out.get("w") ?? 0);
      expect((out.get("s") ?? 0) + (out.get("w") ?? 0)).toBe(30);
    }
    expect(strongTotal / 50).toBeGreaterThan(18); // > equal share of 15
    expect(weakMin).toBeGreaterThanOrEqual(6); // 40% floor / 2 ICPs = 6
  });
});
```

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { LeadOutcomeFlags } from "../optimize/outcomes";
import { sampleBeta } from "../optimize/bandit";

/**
 * Stage 2 discovery allocation: split a scout run's discovery quota across the account's ICPs by
 * Thompson sampling on DEEP conversion evidence (interested-or-booked among invited) — with a 40%
 * exploration floor split equally so no ICP is ever starved by early noise. Zero outcome data ⇒
 * byte-identical equal split. Allocation only: the total target is never raised. Pure; RNG injected.
 */
const EXPLORATION_SHARE = 0.4;

export function allocateDiscovery(
  target: number,
  icps: { id: string; flags: LeadOutcomeFlags[] }[],
  rand: () => number
): Map<string, number> {
  const out = new Map<string, number>();
  if (target <= 0 || icps.length === 0) return out;
  if (icps.length === 1) {
    out.set(icps[0]!.id, target);
    return out;
  }

  const hasData = icps.some((i) => i.flags.some((f) => f.invited));
  if (!hasData) {
    const per = Math.max(1, Math.floor(target / icps.length));
    for (const icp of icps) out.set(icp.id, per);
    return out;
  }

  // Exploration floor: 40% split equally (each ICP always sources something).
  const floorEach = Math.max(1, Math.floor((target * EXPLORATION_SHARE) / icps.length));
  let remaining = target - floorEach * icps.length;
  if (remaining < 0) remaining = 0;

  // Thompson draw per ICP on deep conversion among invited.
  const draws = icps.map((icp) => {
    const invited = icp.flags.filter((f) => f.invited);
    const deep = invited.filter((f) => f.interested || f.booked).length;
    return sampleBeta(1 + deep, 1 + Math.max(0, invited.length - deep), rand);
  });
  const total = draws.reduce((s, d) => s + d, 0) || 1;

  const quotas = icps.map((icp, i) => ({
    id: icp.id,
    quota: floorEach + Math.floor((remaining * draws[i]!) / total),
  }));
  // hand rounding leftovers to the highest draw so quotas sum to target
  let assigned = quotas.reduce((s, q) => s + q.quota, 0);
  const order = draws.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  let k = 0;
  while (assigned < target) {
    quotas[order[k % order.length]!.i]!.quota++;
    assigned++;
    k++;
  }
  for (const q of quotas) out.set(q.id, q.quota);
  return out;
}
```

In `bandit.ts`, change `function sampleBeta` to `export function sampleBeta` (and add a line to its doc comment noting the Stage-2 allocator reuses it).

- [ ] **Step 4: Export `allocateDiscovery` from index; run agent-brains suite** → PASS.

- [ ] **Step 5: Commit** — `feat(brains): Thompson discovery allocation across ICPs with exploration floor (Stage 2)`

---

### Task 3: Wire both tilts into the jobs pipeline

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (`ScoutStore` + `ScoutDeps.rand?`)
- Modify: `packages/jobs/src/pipeline/scout.ts` (allocation)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getTargetingRows`, `getIcpOutcomeRows`, smarter `getTopQualifiedLeadIds`)
- Test: `packages/jobs/src/pipeline/scout.test.ts`

**Interfaces:**
- `ScoutStore.getIcpOutcomeRows(accountId): Promise<{ icpId: string; flags: LeadOutcomeFlags }[]>`
- `ScoutStore.getTargetingRows(accountId): Promise<TargetingRow[]>` (used by pg-store internally for the drain; exposed on the interface for the fake)
- `ScoutDeps.rand?: () => number`

- [ ] **Step 1: Failing scout tests** — with 2 usable ICPs and outcome rows heavily favoring one, `discoverProspects` is called with a larger quota for the favored ICP and every ICP gets ≥ its floor (seeded rand); with no outcome rows, quotas equal today's `Math.max(1, floor(target/n))` split. Follow the existing scout.test.ts fake-store conventions (read them first; add the two methods returning `[]` by default so every existing test keeps passing).

- [ ] **Step 2: Verify FAIL.**

- [ ] **Step 3: scout.ts** — replace the equal split:

```ts
    const fresh: FreshLead[] = [];
    if (icps.length > 0) {
      // Stage 2: allocation learns from outcomes (Thompson on deep conversion, 40% exploration
      // floor). No outcome data ⇒ identical to the old equal split. The TOTAL is never raised.
      const quotas = allocateDiscovery(
        discoveryTarget,
        await (async () => {
          const rows = await deps.store.getIcpOutcomeRows(accountId);
          const byIcp = new Map<string, LeadOutcomeFlags[]>();
          for (const r of rows) {
            const list = byIcp.get(r.icpId) ?? [];
            list.push(r.flags);
            byIcp.set(r.icpId, list);
          }
          return icps.map((icp) => ({ id: icp.id, flags: byIcp.get(icp.id) ?? [] }));
        })(),
        deps.rand ?? Math.random
      );
      for (const icp of icps) {
        const quota = quotas.get(icp.id) ?? 0;
        if (quota <= 0) continue;
        const candidates = await deps.prospectData.discoverProspects(icpCriteriaToFilters(icp.criteria), quota);
        discovered += candidates.length;
        fresh.push(...(await deps.store.upsertLeads(accountId, icp.id, candidates)));
      }
    }
```

- [ ] **Step 4: pg-store** — add the two read methods (same reply-join pattern as `getStampedOutcomes`, filtered to `linkedin_invited_at is not null`; `getIcpOutcomeRows` additionally `icp_id is not null`), and upgrade the drain:

```ts
    async getTopQualifiedLeadIds(accountId: string, limit: number) {
      if (limit <= 0) return [];
      // qualified, not-yet-drafted leads, best first. Stage 2: ordering = ai_score + the bounded
      // outcome tilt (rankByTilt) so buyers like the ones who actually replied/booked drain first.
      // Ordering ONLY — the qualification gate and the draft budget are unchanged.
      const rows = await db
        .select({ id: leads.id, title: leads.title, industry: leads.industry, aiScore: leads.aiScore, scoredAt: leads.scoredAt })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.status, "qualified")))
        .orderBy(desc(leads.aiScore), desc(leads.scoredAt));
      const profile = buildTargetingProfile(await this.getTargetingRows(accountId));
      return rankByTilt(rows, profile).slice(0, limit).map((r) => r.id);
    },
```

(NB: `this.` doesn't exist in the object-literal store — hoist `getTargetingRows`'s body into a module-level `async function targetingRows(db, accountId)` next to `winningOpeners` and call it from both the interface method and the drain. Import `buildTargetingProfile`, `rankByTilt` from `@vantera/agent-brains`.)

- [ ] **Step 5: Run the jobs suite** → PASS (fakes updated).

- [ ] **Step 6: Commit** — `feat(jobs): outcome-tilted discovery allocation + qualified-pool drain (Stage 2)`

---

### Task 4: Visibility line + knowledge sync + ship

**Files:**
- Modify: `apps/web/src/lib/optimize.ts` (+ `targetingFocus` on the VM)
- Modify: `apps/web/src/app/(app)/analytics/outreach-diagnosis.tsx`
- Modify: `packages/help-content/content/optimization.md`

- [ ] **Step 1: VM** — add to `OutreachDiagnosisVM`:

```ts
  /** Stage 2: the buyer segment Vera is prioritizing, with the real numbers behind it.
   *  Null until a segment passes the sample floor — never an invented focus. */
  targetingFocus: { label: string; deep: number; n: number; baselineDeep: number; baselineN: number } | null;
```

In `loadOutreachDiagnosis`, fetch invited leads (`title, industry, linkedin_connected_at, meeting_booked_at, id` where `linkedin_invited_at` not null), build `TargetingRow[]` using the already-fetched interested lead_ids for the `interested` flag, and:

```ts
  const profile = buildTargetingProfile(rows);
  const top = topTiltSegment(profile);
  const targetingFocus = top
    ? { label: top.label, deep: top.stat.deep, n: top.stat.n, baselineDeep: top.baseline.deep, baselineN: top.baseline.n }
    : null;
```

- [ ] **Step 2: Panel line** in outreach-diagnosis.tsx (near the What's-working content, style-matched, voice pronoun-free):

```tsx
{vm.targetingFocus && (
  <p className="mt-1.5 text-sm text-muted-foreground">
    Prioritizing {vm.targetingFocus.label}: {vm.targetingFocus.deep} of {vm.targetingFocus.n} went
    interested, above your average of {vm.targetingFocus.baselineDeep} in {vm.targetingFocus.baselineN}.
  </p>
)}
```

- [ ] **Step 3: Help article** — after "How the testing works", add:

```markdown
## Vera learns who your real buyers are

Every outcome also teaches Vera who to go after. When certain kinds of buyers — a seniority, an
industry — keep accepting, replying, and booking, Vera sources more of them and moves them to
the front of the queue. The quality bar never changes: every lead still has to pass the same
qualification score, and totals never increase. Vera just spends your outreach where your real
buyers are. This only kicks in once there's enough of your own data to trust (a handful of real
outcomes per group), and the panel shows you exactly which group is being prioritized and why.
```

- [ ] **Step 4: Full gate** → green. Commit web+help: `feat(web): targeting-focus line + help (Stage 2, knowledge-sync)`.

- [ ] **Step 5: Ship** — push branch → origin main (worktree holds local main), Trigger auto-deploys (expect v20260714.10), promote Vercel + domain 200 check. No migration.

- [ ] **Step 6: Verify prod** — running experiments untouched; `getTopQualifiedLeadIds` behavior proof: trigger nothing (drain fires on next scout run); honest status = tests + inertness guarantees; check Vantera account's invited/outcome counts to state whether any segment passes the floor TODAY (it may — ~200 invited).

- [ ] **Step 7: Memory + report.**
