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

/** Bounded ordering adjustment for one candidate — 0 whenever the evidence is thin. */
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
  const baseDeep = profile.baseline.deep / profile.baseline.n;
  const baseAccept = profile.baseline.accepted / profile.baseline.n;
  let best: { key: string; stat: SegmentStat; score: number } | null = null;
  for (const [key, stat] of profile.segments) {
    if (stat.n < SEGMENT_FLOOR) continue;
    // "other" = titles we couldn't classify — real for the tilt math, meaningless as a UI focus
    // ("prioritizing other roles" tells the user nothing actionable).
    if (key === "seniority:other") continue;
    // prefer deep-conversion evidence; fall back to acceptance when deep rates tie
    const score = stat.deep / stat.n - baseDeep || stat.accepted / stat.n - baseAccept;
    if (score > 0 && (!best || score > best.score)) best = { key, stat, score };
  }
  if (!best) return null;
  const [kind, value] = best.key.split(":") as [string, string];
  const label = kind === "seniority" ? (BUCKET_LABEL[value] ?? value) : `${value} buyers`;
  return { key: best.key, label, stat: best.stat, baseline: profile.baseline };
}
