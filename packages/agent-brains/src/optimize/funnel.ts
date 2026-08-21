/**
 * Outreach funnel + confidence — the measurement layer of the self-optimizing loop
 * (docs/superpowers/specs/2026-06-29-self-optimizing-outreach-design.md).
 *
 * Pure and deterministic (no model, no DB): raw per-stage counts → per-stage conversion rates with
 * Wilson-score 95% confidence intervals and a minimum-sample gate. The gate is a core guardrail — a
 * rate measured over too few touches is noise, not signal, so the diagnosis layer never acts on it.
 */

/** A stage's conversion is trustworthy only once its denominator clears this. Below it the rate is
 *  still shown but marked `enoughData: false`, and diagnose.ts refuses to act on it. */
export const MIN_STAGE_SAMPLE = 20;
/** At/above this the diagnosis is reported as "clear" rather than "early". */
export const STRONG_STAGE_SAMPLE = 50;

export type OutreachFunnelInput = {
  /** connection requests sent (leads.linkedin_invited_at) */
  invited: number;
  /** accepted the request (leads.linkedin_connected_at) */
  accepted: number;
  /** gave an interested reply (distinct leads with replies.classification='interested') */
  interestedReplies: number;
  /** booked a meeting (leads.meeting_booked_at) */
  booked: number;
  /** closed-won (leads.status='converted') */
  closed: number;
};

export type FunnelStageKey = "acceptance" | "reply" | "booking" | "close";

export type StageStatus = "below" | "healthy" | "above";
export type StageBand = { low: number; high: number; status: StageStatus };
export type WilsonInterval = { low: number; high: number };

export type OutreachFunnelStage = {
  key: FunnelStageKey;
  label: string;
  /** what the stage converts FROM → TO, for copy */
  from: string;
  to: string;
  numerator: number;
  denominator: number;
  /** conversion %, 0–100; null when there is nothing to convert (denominator 0) */
  ratePct: number | null;
  /** Wilson 95% interval as percentages [0,100]; null when denominator 0 */
  ci: WilsonInterval | null;
  /** denominator ≥ MIN_STAGE_SAMPLE */
  enoughData: boolean;
  /** typical reference band + where this rate sits; null when the rate is unknown */
  benchmark: StageBand | null;
};

// Reference bands for QUALITY LinkedIn outreach (fewer, better-targeted touches — not blast).
// Conservative, clearly "typical", never a promise or a target. Mirrors the reference-band
// convention in apps/web/src/lib/revenue.ts.
const STAGE_META: Record<
  FunnelStageKey,
  { label: string; from: string; to: string; band: { low: number; high: number } }
> = {
  acceptance: { label: "Connection acceptance", from: "invites sent", to: "accepted", band: { low: 25, high: 45 } },
  reply: { label: "Reply rate", from: "connections", to: "interested replies", band: { low: 12, high: 30 } },
  booking: { label: "Booking rate", from: "interested replies", to: "meetings booked", band: { low: 25, high: 45 } },
  close: { label: "Close rate", from: "meetings booked", to: "closed deals", band: { low: 20, high: 40 } },
};

const STAGE_ORDER: FunnelStageKey[] = ["acceptance", "reply", "booking", "close"];

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
/** proportion (0–1) → percentage (0–100), one decimal, clamped */
function pct(x: number): number {
  return Math.round(clamp01(x) * 1000) / 10;
}

/** Wilson score interval (95%, z=1.96) for a binomial proportion, returned as percentages [0,100]. */
export function wilsonInterval(numerator: number, denominator: number): WilsonInterval {
  if (denominator <= 0) return { low: 0, high: 0 };
  const z = 1.96;
  const n = denominator;
  const p = clamp01(numerator / n);
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { low: pct(center - margin), high: pct(center + margin) };
}

function bandFor(key: FunnelStageKey, ratePct: number | null): StageBand | null {
  if (ratePct == null) return null;
  const { low, high } = STAGE_META[key].band;
  const status: StageStatus = ratePct < low ? "below" : ratePct > high ? "above" : "healthy";
  return { low, high, status };
}

/** Build the ordered outreach funnel with rates, Wilson CIs, sample gating, and reference bands. */
export function computeOutreachFunnel(input: OutreachFunnelInput): OutreachFunnelStage[] {
  const pairs: Record<FunnelStageKey, { num: number; den: number }> = {
    acceptance: { num: input.accepted, den: input.invited },
    reply: { num: input.interestedReplies, den: input.accepted },
    booking: { num: input.booked, den: input.interestedReplies },
    close: { num: input.closed, den: input.booked },
  };
  return STAGE_ORDER.map((key) => {
    const { num, den } = pairs[key];
    const meta = STAGE_META[key];
    const ratePct = den > 0 ? pct(num / den) : null;
    return {
      key,
      label: meta.label,
      from: meta.from,
      to: meta.to,
      numerator: num,
      denominator: den,
      ratePct,
      ci: den > 0 ? wilsonInterval(num, den) : null,
      enoughData: den >= MIN_STAGE_SAMPLE,
      benchmark: bandFor(key, ratePct),
    };
  });
}
