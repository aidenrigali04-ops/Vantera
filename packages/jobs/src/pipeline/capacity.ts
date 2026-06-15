import { dailyAllowance, EMAIL_STEADY_DAILY_PER_MAILBOX } from "./safety-limits";

export interface MailboxCapacity {
  /** "warming" carries the provider's current warmup cap; "ready" sends at the steady ceiling */
  phase: "warming" | "ready";
  dailyCap: number;
}

export interface OutreachCapacity {
  linkedinConnected: boolean;
  linkedinAccountAgeDays: number | null;
  linkedinEnabled: boolean;
  emailEnabled: boolean;
  mailboxes: MailboxCapacity[];
}

export interface RunTargetOpts {
  cadenceDays: number;    // 1 (daily) or 7 (weekly)
  currentBacklog: number; // in-flight leads not yet contacted
  bufferFactor: number;   // headroom so the sequence never starves
  floor: number;          // minimum batch when any capacity exists
  ceiling: number;        // config.prospectsPerRun — hard upper bound; capacity may clamp below it
}

export const CAPACITY_DEFAULTS = { bufferFactor: 1.3, floor: 5 } as const;

/** Total leads that can actually be reached per day across enabled, ready/warming channels. */
export function dailyOutreachCapacity(c: OutreachCapacity): number {
  // null age (connected but age unknown) → treat as blocked until age is known.
  // We use the invite ceiling: invites dominate new-account sequences during warmup.
  const linkedinDaily =
    c.linkedinEnabled && c.linkedinConnected && c.linkedinAccountAgeDays !== null
      ? dailyAllowance("linkedin", c.linkedinAccountAgeDays)
      : 0;
  const emailDaily = c.emailEnabled
    ? c.mailboxes.reduce(
        (sum, m) =>
          sum + (m.phase === "ready" ? EMAIL_STEADY_DAILY_PER_MAILBOX : Math.max(0, m.dailyCap)),
        0,
      )
    : 0;
  return linkedinDaily + emailDaily;
}

/** How many fresh leads to pull this run. Never exceeds the ceiling; 0 in a dead-zone or full backlog. */
export function computeRunTarget(c: OutreachCapacity, o: RunTargetOpts): number {
  const daily = dailyOutreachCapacity(c);
  if (daily <= 0) return 0; // no channel can act — don't enrich unreachable leads
  const projected = Math.round(daily * o.cadenceDays * o.bufferFactor);
  const raw = projected - o.currentBacklog;
  if (raw <= 0) return 0; // backlog already covers capacity — don't pile on
  return Math.min(o.ceiling, Math.max(o.floor, raw));
}
