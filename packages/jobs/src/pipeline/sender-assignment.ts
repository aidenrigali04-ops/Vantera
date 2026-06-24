import { LINKEDIN_WEEKLY_INVITE_CEILING, dailyAllowance } from "./safety-limits";

/**
 * Multi-sender distribution (rule 04/13). A tenant may have several connected
 * LinkedIn accounts; each one is an independent sender with its own safety budget.
 * This module decides WHICH sender a new lead's invite goes to — capacity-weighted
 * least-loaded — so volume spreads and no single account trips LinkedIn's limits.
 * Pure: no DB, no Trigger. The caller supplies a snapshot of each sender's state.
 */
export interface SenderCandidate {
  linkedinAccountId: string;
  /** That account's own connection age, in days — drives its warmup ramp. */
  ageDays: number;
  /** Invites this account has already sent today. */
  sentToday: number;
  /** Invites this account has sent in the rolling last 7 days. */
  last7d: number;
  /** Epoch ms of this account's most recent lead assignment (0 if never). */
  lastAssignedAt: number;
  /** status === 'active' — paused/restricted/disconnected accounts are excluded. */
  healthy: boolean;
}

/** Invites this account may still send today, clamped by both daily ramp and the 7-day ceiling. */
export function inviteBudget(c: SenderCandidate): number {
  const daily = dailyAllowance("linkedin", c.ageDays) - c.sentToday;
  const weekly = LINKEDIN_WEEKLY_INVITE_CEILING - c.last7d;
  return Math.max(0, Math.min(daily, weekly));
}

/**
 * Pick the sender for a new lead: the healthy account with the most remaining invite
 * budget, ties broken by least-recently-assigned for even spread. Null when no healthy
 * account has budget left this cycle (the lead is parked until budget frees up).
 */
export function assignSender(candidates: SenderCandidate[]): string | null {
  const eligible = candidates
    .filter((c) => c.healthy && inviteBudget(c) > 0)
    .sort((a, b) => inviteBudget(b) - inviteBudget(a) || a.lastAssignedAt - b.lastAssignedAt);
  return eligible[0]?.linkedinAccountId ?? null;
}
