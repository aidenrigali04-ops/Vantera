import 'server-only'

import { db } from '@/lib/db/client'
import { accountInvites, users } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type AccountPlan = 'team' | 'enterprise'

/** Monthly price per billable seat, in whole USD. */
export const SEAT_PRICE_USD = 25

/**
 * Seats included with each plan before per-seat billing kicks in.
 * Team: the owner. Enterprise: owner + 4 (five free seats).
 */
export const INCLUDED_SEATS: Record<AccountPlan, number> = {
  team: 1,
  enterprise: 5,
}

export function includedSeatsForPlan(plan: AccountPlan): number {
  return INCLUDED_SEATS[plan] ?? INCLUDED_SEATS.team
}

export type SeatUsage = {
  plan: AccountPlan
  /** Active members occupying a seat (not soft-deleted). */
  activeMembers: number
  /** Outstanding pending invitations (each reserves a seat). */
  pendingInvites: number
  /** activeMembers + pendingInvites. */
  totalSeats: number
  /** Seats included free with the plan. */
  includedSeats: number
  /** Seats billed at SEAT_PRICE_USD each = max(0, totalSeats - includedSeats). */
  billableSeats: number
  /** Monthly seat cost in whole USD. */
  monthlySeatCostUsd: number
}

/**
 * The single source of truth for seat counting. A seat is occupied by an
 * active `users` row or a pending `account_invites` row.
 */
export async function getSeatUsage(
  accountId: string,
  plan: AccountPlan,
): Promise<SeatUsage> {
  const [[memberRow], [inviteRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.accountId, accountId), isNull(users.deletedAt))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountInvites)
      .where(
        and(eq(accountInvites.accountId, accountId), eq(accountInvites.status, 'pending')),
      ),
  ])

  const activeMembers = memberRow?.count ?? 0
  const pendingInvites = inviteRow?.count ?? 0
  const totalSeats = activeMembers + pendingInvites
  const includedSeats = includedSeatsForPlan(plan)
  const billableSeats = Math.max(0, totalSeats - includedSeats)

  return {
    plan,
    activeMembers,
    pendingInvites,
    totalSeats,
    includedSeats,
    billableSeats,
    monthlySeatCostUsd: billableSeats * SEAT_PRICE_USD,
  }
}

/**
 * Billable seat count for credit/billing math. Returns 0 if the invites table
 * isn't present yet (pre-migration safety) so credit reads never hard-fail.
 */
export async function getBillableSeatCount(
  accountId: string,
  plan: AccountPlan,
): Promise<number> {
  try {
    const usage = await getSeatUsage(accountId, plan)
    return usage.billableSeats
  } catch {
    return 0
  }
}
