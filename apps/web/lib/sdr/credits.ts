import 'server-only'

import type { OnboardingPlanId } from '@/lib/onboarding/pricing-plans'
import { db } from '@/lib/db/client'
import {
  SDR_CREDIT_COSTS,
  SDR_MONTHLY_ALLOWANCE,
  SDR_TRIAL_DAYS,
  parseStoredCredits,
  type SdrBillingTier,
  type SdrCreditAction,
  type SdrCreditStatus,
} from '@/lib/sdr/credit-types'
export type { SdrBillingTier, SdrCreditAction, SdrCreditStatus } from '@/lib/sdr/credit-types'
export {
  SDR_CREDIT_COSTS,
  SDR_LEAD_PULL_COST,
  SDR_MONTHLY_ALLOWANCE,
  SDR_OUTREACH_SEND_COST,
  SDR_TRIAL_DAYS,
  formatSdrCredits,
  outreachSendCostForChannel,
  parseStoredCredits,
} from '@/lib/sdr/credit-types'
import { accounts, sdrCreditAccounts, sdrCreditLedger } from '@vantera/db'
import { eq, sql } from 'drizzle-orm'

export class SdrCreditsExhaustedError extends Error {
  readonly code = 'SDR_CREDITS_EXHAUSTED' as const

  constructor(message = 'SDR outreach credits exhausted for this billing period') {
    super(message)
    this.name = 'SdrCreditsExhaustedError'
  }
}

export function onboardingPlanToBillingTier(planId: OnboardingPlanId): SdrBillingTier {
  if (planId === 'enterprise') return 'premium'
  if (planId === 'team') return 'standard'
  return 'free'
}

export function planToDefaultBillingTier(plan: 'team' | 'enterprise'): SdrBillingTier {
  return plan === 'enterprise' ? 'premium' : 'standard'
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function nextUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

function isTrialActive(trialEndsAt: Date | null): boolean {
  return Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now())
}

function effectiveTier(
  billingTier: SdrBillingTier,
  trialEndsAt: Date | null,
): SdrBillingTier {
  if (isTrialActive(trialEndsAt)) return 'standard'
  return billingTier
}

function allowanceForTier(tier: SdrBillingTier): number | null {
  return SDR_MONTHLY_ALLOWANCE[tier]
}

async function resetPeriodIfNeeded(
  accountId: string,
  row: typeof sdrCreditAccounts.$inferSelect,
): Promise<typeof sdrCreditAccounts.$inferSelect> {
  const now = new Date()
  const periodStart = new Date(row.periodStart)
  const currentMonthStart = startOfUtcMonth(now)
  if (periodStart >= currentMonthStart) return row

  const [updated] = await db
    .update(sdrCreditAccounts)
    .set({
      usedThisPeriod: '0',
      periodStart: currentMonthStart,
      updatedAt: now,
    })
    .where(eq(sdrCreditAccounts.accountId, accountId))
    .returning()

  return updated ?? { ...row, usedThisPeriod: '0', periodStart: currentMonthStart }
}

export async function ensureSdrCreditAccount(
  accountId: string,
  billingTier?: SdrBillingTier,
): Promise<void> {
  const [existing] = await db
    .select({ accountId: sdrCreditAccounts.accountId })
    .from(sdrCreditAccounts)
    .where(eq(sdrCreditAccounts.accountId, accountId))
    .limit(1)

  if (existing) return

  let tier = billingTier
  if (!tier) {
    const [account] = await db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)
    tier = planToDefaultBillingTier((account?.plan ?? 'team') as 'team' | 'enterprise')
  }

  await db.insert(sdrCreditAccounts).values({
    accountId,
    billingTier: tier,
    usedThisPeriod: '0',
    periodStart: startOfUtcMonth(new Date()),
  })
}

export async function initSdrCreditAccountFromOnboarding(
  accountId: string,
  planId: OnboardingPlanId,
): Promise<void> {
  const tier = onboardingPlanToBillingTier(planId)
  await db
    .insert(sdrCreditAccounts)
    .values({
      accountId,
      billingTier: tier,
      usedThisPeriod: '0',
      periodStart: startOfUtcMonth(new Date()),
    })
    .onConflictDoUpdate({
      target: sdrCreditAccounts.accountId,
      set: {
        billingTier: tier,
        updatedAt: new Date(),
      },
    })
}

export async function getSdrCreditStatus(accountId: string): Promise<SdrCreditStatus> {
  await ensureSdrCreditAccount(accountId)

  const [row] = await db
    .select()
    .from(sdrCreditAccounts)
    .where(eq(sdrCreditAccounts.accountId, accountId))
    .limit(1)

  if (!row) {
    throw new Error('SDR credit account missing')
  }

  const current = await resetPeriodIfNeeded(accountId, row)
  const billingTier = current.billingTier as SdrBillingTier
  const trialEndsAt = current.trialEndsAt
  const tier = effectiveTier(billingTier, trialEndsAt)
  const limit = allowanceForTier(tier)
  const used = parseStoredCredits(current.usedThisPeriod)
  const unlimited = limit === null
  const remaining = unlimited ? null : Math.max(0, Math.round((limit - used) * 10) / 10)
  const periodStart = new Date(current.periodStart)

  return {
    accountId,
    billingTier,
    effectiveTier: tier,
    used,
    limit,
    remaining,
    unlimited,
    trialActive: isTrialActive(trialEndsAt),
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    periodStart: periodStart.toISOString(),
    periodResetsAt: nextUtcMonthStart(periodStart).toISOString(),
  }
}

export async function canConsumeSdrCredits(
  accountId: string,
  credits = SDR_CREDIT_COSTS.scout_enroll,
): Promise<boolean> {
  const status = await getSdrCreditStatus(accountId)
  if (status.unlimited) return true
  return (status.remaining ?? 0) >= credits - 1e-9
}

export async function consumeSdrCredits(
  accountId: string,
  action: SdrCreditAction,
  referenceId?: string,
  credits?: number,
  metadata: Record<string, unknown> = {},
): Promise<SdrCreditStatus> {
  const cost = credits ?? SDR_CREDIT_COSTS[action]
  const status = await getSdrCreditStatus(accountId)

  if (!status.unlimited && (status.remaining ?? 0) < cost - 1e-9) {
    throw new SdrCreditsExhaustedError()
  }

  const costStr = String(Math.round(cost * 10) / 10)

  if (status.unlimited) {
    await db.insert(sdrCreditLedger).values({
      accountId,
      action,
      credits: costStr,
      referenceId: referenceId ?? null,
      metadata: { unlimited: true, ...metadata },
    })
    return status
  }

  const [updated] = await db
    .update(sdrCreditAccounts)
    .set({
      usedThisPeriod: sql`${sdrCreditAccounts.usedThisPeriod} + ${costStr}::numeric`,
      updatedAt: new Date(),
    })
    .where(eq(sdrCreditAccounts.accountId, accountId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update SDR credit balance')
  }

  await db.insert(sdrCreditLedger).values({
    accountId,
    action,
    credits: costStr,
    referenceId: referenceId ?? null,
    metadata,
  })

  return getSdrCreditStatus(accountId)
}

export async function startSdrTrial(accountId: string): Promise<SdrCreditStatus> {
  await ensureSdrCreditAccount(accountId)

  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + SDR_TRIAL_DAYS * 24 * 60 * 60 * 1000)

  await db
    .update(sdrCreditAccounts)
    .set({
      trialStartedAt: now,
      trialEndsAt,
      updatedAt: now,
    })
    .where(eq(sdrCreditAccounts.accountId, accountId))

  return getSdrCreditStatus(accountId)
}
