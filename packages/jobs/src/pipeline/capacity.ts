import { dailyAllowance } from "./safety-limits";

export interface OutreachCapacity {
  linkedinConnected: boolean;
  linkedinAccountAgeDays: number | null;
  linkedinEnabled: boolean;
}

export interface RunTargetOpts {
  cadenceDays: number;    // 1 (daily) or 7 (weekly)
  currentBacklog: number; // in-flight leads not yet contacted
  bufferFactor: number;   // headroom so the sequence never starves
  floor: number;          // minimum batch when any capacity exists
  ceiling: number;        // config.prospectsPerRun — hard upper bound; capacity may clamp below it
}

export const CAPACITY_DEFAULTS = { bufferFactor: 1.3, floor: 5 } as const;

/**
 * Leads a Scout sources before LinkedIn is connected, so prospects still land on the
 * dashboard/pipeline while the user connects their account. Bounded: a no-channel account
 * tops up toward this cap and then stops, so it can't accumulate forever.
 */
export const NO_CHANNEL_PREVIEW_CAP = 25;

/** Total leads that can actually be reached per day via the connected LinkedIn account. */
export function dailyOutreachCapacity(c: OutreachCapacity): number {
  // null age (connected but age unknown) → treat as blocked until age is known.
  // We use the invite ceiling: invites dominate new-account sequences during warmup.
  return c.linkedinEnabled && c.linkedinConnected && c.linkedinAccountAgeDays !== null
    ? dailyAllowance("linkedin", c.linkedinAccountAgeDays)
    : 0;
}

/**
 * The DRAFT budget: how many qualified leads to draft → send this run. Send-paced + cadence-scaled,
 * clamped by the in-flight drafted backlog so the review queue never runs ahead of what the account
 * can actually send. Never exceeds the ceiling; 0 once the backlog covers capacity.
 */
export function computeRunTarget(c: OutreachCapacity, o: RunTargetOpts): number {
  const daily = dailyOutreachCapacity(c);
  if (daily <= 0) {
    // LinkedIn can't send yet — still draft a bounded preview so prospects land on the
    // dashboard/pipeline; outreach waits until the account connects. Tops up toward the
    // preview cap (never past it) and trickles at most a floor batch per run.
    return Math.max(0, Math.min(o.floor, NO_CHANNEL_PREVIEW_CAP - o.currentBacklog));
  }
  const projected = Math.round(daily * o.cadenceDays * o.bufferFactor);
  const raw = projected - o.currentBacklog;
  if (raw <= 0) return 0; // backlog already covers capacity — don't pile on
  return Math.min(o.ceiling, Math.max(o.floor, raw));
}

// ── Overscan (2026-06-23) ────────────────────────────────────────────────────
// Discovery is cheap (Apify LinkedIn search ~$4/1k), so we DECOUPLE the pull from send capacity:
// source a large pool of QUALIFIED leads the gate selects from — a big, visible influx on Leads —
// while DRAFTING/sending stays send-paced + best-first (computeRunTarget), so the review queue
// never floods. The pool target caps total cost: once it's full, discovery idles until drafting
// drains it; per-run discovery is capped so one run can't run up an unbounded bill. Both tunable.
export const QUALIFIED_POOL_TARGET = 300;
export const DISCOVERY_PER_RUN_CAP = 150;

/**
 * The DISCOVERY target: how many raw prospects to pull this run. Decoupled from send capacity —
 * pull a capped batch (cadence-scaled) to refill the qualified pool until it reaches the target,
 * then idle. Before LinkedIn is connected, source only a small bounded preview so leads still land.
 */
export function computeDiscoveryTarget(o: {
  dailyCapacity: number;
  qualifiedPool: number;
  cadenceDays: number;
  totalLeads: number;
}): number {
  if (o.dailyCapacity <= 0) {
    // no channel yet — a small bounded preview so prospects appear while the user connects
    return Math.max(0, Math.min(CAPACITY_DEFAULTS.floor, NO_CHANNEL_PREVIEW_CAP - o.totalLeads));
  }
  if (o.qualifiedPool >= QUALIFIED_POOL_TARGET) return 0; // pool full — let drafting drain it first
  return DISCOVERY_PER_RUN_CAP * o.cadenceDays;
}
