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

/** How many fresh leads to pull this run. Never exceeds the ceiling; 0 once the backlog is full. */
export function computeRunTarget(c: OutreachCapacity, o: RunTargetOpts): number {
  const daily = dailyOutreachCapacity(c);
  if (daily <= 0) {
    // LinkedIn can't send yet — still source a bounded preview so prospects land on the
    // dashboard/pipeline; outreach waits until the account connects. Tops up toward the
    // preview cap (never past it) and trickles at most a floor batch per run.
    return Math.max(0, Math.min(o.floor, NO_CHANNEL_PREVIEW_CAP - o.currentBacklog));
  }
  const projected = Math.round(daily * o.cadenceDays * o.bufferFactor);
  const raw = projected - o.currentBacklog;
  if (raw <= 0) return 0; // backlog already covers capacity — don't pile on
  return Math.min(o.ceiling, Math.max(o.floor, raw));
}
