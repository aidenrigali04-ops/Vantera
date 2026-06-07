export type SdrBillingTier = 'free' | 'standard' | 'premium'

export type SdrCreditAction = 'pipeline_enroll' | 'outreach_send' | 'scout_enroll'

/** Credits charged per SDR lead pulled / enrolled. */
export const SDR_LEAD_PULL_COST = 0.1

/** Credits charged per email, SMS, or LinkedIn outreach step. */
export const SDR_OUTREACH_SEND_COST = 0.3

export const SDR_CREDIT_COSTS: Record<SdrCreditAction, number> = {
  pipeline_enroll: SDR_LEAD_PULL_COST,
  scout_enroll: SDR_LEAD_PULL_COST,
  outreach_send: SDR_OUTREACH_SEND_COST,
}

/** Monthly SDR outreach credits by tier (`null` = unlimited). */
export const SDR_MONTHLY_ALLOWANCE: Record<SdrBillingTier, number | null> = {
  free: 100,
  standard: 500,
  premium: null,
}

/**
 * Credits each paid seat adds to the shared account pool. Seats top up one
 * shared pool (not per-seat buckets) — the agents spend on the whole account's
 * behalf, so adding a teammate means "more capacity for everyone." Only lifts
 * metered tiers; `premium` is already unlimited and `free` bills no seats.
 */
export const SEAT_CREDIT_BONUS = 250

/** Monthly allowance including the seat top-up for the shared pool. */
export function monthlyAllowance(
  tier: SdrBillingTier,
  billableSeats = 0,
): number | null {
  const base = SDR_MONTHLY_ALLOWANCE[tier]
  if (base === null) return null
  return base + SEAT_CREDIT_BONUS * Math.max(0, billableSeats)
}

/** SDR Standard-tier trial length in days. */
export const SDR_TRIAL_DAYS = 3

export type SdrCreditStatus = {
  accountId: string
  billingTier: SdrBillingTier
  effectiveTier: SdrBillingTier
  used: number
  limit: number | null
  remaining: number | null
  unlimited: boolean
  trialActive: boolean
  trialEndsAt: string | null
  periodStart: string
  periodResetsAt: string
}

export function parseStoredCredits(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  return Math.round(Number(value) * 10) / 10
}

export function formatSdrCredits(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function outreachSendCostForChannel(
  channel: 'email' | 'sms' | 'linkedin' | string,
): number {
  if (channel === 'email' || channel === 'sms' || channel === 'linkedin') {
    return SDR_OUTREACH_SEND_COST
  }
  return SDR_OUTREACH_SEND_COST
}
