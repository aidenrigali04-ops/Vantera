import type { LeadOutcomeFlags } from "../optimize/outcomes";

/**
 * Stage 2 targeting profile (spec 2026-07-14): learn WHO actually converts from the account's own
 * funnel outcomes (accepts → interested replies → bookings) and tilt the draft-drain ordering
 * toward them. Derived at read time, bounded (±TILT_CAP points on top of ai_score), floor-gated
 * (a segment tilts nothing until it has real sample), and ordering-only — the qualification gate
 * and all volume caps are untouched. Pure.
 */

export type TargetingRow = {
  title: string | null;
  industry: string | null;
  flags: LeadOutcomeFlags;
};
export type SegmentStat = { n: number; accepted: number; deep: number };
export interface TargetingProfile {
  baseline: SegmentStat;
  segments: Map<string, SegmentStat>;
}

/** A segment needs this many INVITED leads before it may tilt anything. */
export const SEGMENT_FLOOR = 8;
const TILT_CAP = 5;
const ACCEPT_POINTS = 10; // rate-delta → points scale, capped per component
const DEEP_POINTS = 15;
const ACCEPT_CAP = 2;
const DEEP_CAP = 3;

/**
 * Empirical-Bayes shrinkage strength (pseudo-observations) pulling a segment's accept/deep rate
 * toward the ACCOUNT baseline before the delta math — same M as the bandit prior (bandit.ts),
 * targeted at the account's own baseline rather than a pooled-across-accounts one. Evidence
 * (tilt.test.ts): an 8-lead segment (n = SEGMENT_FLOOR, the minimum that isn't zeroed outright)
 * with a single lucky accept swung to ~1.8 points pre-shrinkage off one coin-flip observation; at
 * M = 25 that drops to 0.4 — the segment's 8 real observations are properly outweighed by 25
 * pseudo-observations at the account's real baseline rate.
 */
const SHRINK_M = 25;

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

export function buildTargetingProfile(rows: TargetingRow[]): TargetingProfile {
  const baseline: SegmentStat = { n: 0, accepted: 0, deep: 0 };
  const segments = new Map<string, SegmentStat>();
  for (const r of rows) {
    if (!r.flags.invited) continue;
    const deep = r.flags.interested || r.flags.booked;
    baseline.n++;
    if (r.flags.accepted) baseline.accepted++;
    if (deep) baseline.deep++;
    for (const key of segmentKeys(r)) {
      const s = segments.get(key) ?? { n: 0, accepted: 0, deep: 0 };
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

/** A segment's observed rate shrunk toward the account `baseline` with SHRINK_M pseudo-observations. */
function shrinkRate(observed: number, n: number, baseline: number): number {
  return (observed + SHRINK_M * baseline) / (n + SHRINK_M);
}

/**
 * One segment's shrunk accept+deep contribution against the account baseline — shared by
 * targetingTilt (which takes the MAX across a lead's qualifying segments, never the sum) and
 * topTiltSegment (so the UI's "top segment" pick is scored on the same math the ranker used).
 */
function segmentContribution(s: SegmentStat, baseAccept: number, baseDeep: number): number {
  const acceptRate = shrinkRate(s.accepted, s.n, baseAccept);
  const deepRate = shrinkRate(s.deep, s.n, baseDeep);
  return (
    clamp((acceptRate - baseAccept) * ACCEPT_POINTS, -ACCEPT_CAP, ACCEPT_CAP) +
    clamp((deepRate - baseDeep) * DEEP_POINTS, -DEEP_CAP, DEEP_CAP)
  );
}

/**
 * Bounded ordering adjustment for one candidate — 0 whenever the evidence is thin. A lead's
 * qualifying segments (seniority + industry) contribute the MAX of their shrunk deltas, not the
 * sum: the same lead is being measured twice by correlated evidence (a founder who's also in
 * fintech is one signal, not two), and summing let a single lead's segments double-count and
 * saturate the cap (see tilt.test.ts's max-not-sum fixture).
 */
export function targetingTilt(
  lead: { title: string | null; industry: string | null },
  profile: TargetingProfile
): number {
  if (profile.baseline.n < SEGMENT_FLOOR) return 0;
  const baseAccept = profile.baseline.accepted / profile.baseline.n;
  const baseDeep = profile.baseline.deep / profile.baseline.n;
  const contributions: number[] = [];
  for (const key of segmentKeys(lead)) {
    const s = profile.segments.get(key);
    if (!s || s.n < SEGMENT_FLOOR) continue;
    contributions.push(segmentContribution(s, baseAccept, baseDeep));
  }
  if (contributions.length === 0) return 0;
  const tilt = Math.max(...contributions);
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
  const baseDeep = profile.baseline.deep / profile.baseline.n;
  const baseAccept = profile.baseline.accepted / profile.baseline.n;
  let best: { key: string; stat: SegmentStat; score: number } | null = null;
  for (const [key, stat] of profile.segments) {
    if (stat.n < SEGMENT_FLOOR) continue;
    // "other" = titles we couldn't classify — real for the tilt math, meaningless as a UI focus
    // ("prioritizing other roles" tells the user nothing actionable).
    if (key === "seniority:other") continue;
    // prefer deep-conversion evidence; fall back to acceptance when deep rates tie — both computed
    // on the SAME shrunk math targetingTilt uses (shrinkRate), so the panel's "top segment" is
    // honest about what the ranker actually favored, not a raw-rate figure the ranker never sees.
    const shrunkDeepDelta = shrinkRate(stat.deep, stat.n, baseDeep) - baseDeep;
    const shrunkAcceptDelta = shrinkRate(stat.accepted, stat.n, baseAccept) - baseAccept;
    const score = shrunkDeepDelta || shrunkAcceptDelta;
    if (score > 0 && (!best || score > best.score)) best = { key, stat, score };
  }
  if (!best) return null;
  const [kind, value] = best.key.split(":") as [string, string];
  const label = kind === "seniority" ? (BUCKET_LABEL[value] ?? value) : `${value} buyers`;
  return { key: best.key, label, stat: best.stat, baseline: profile.baseline };
}
