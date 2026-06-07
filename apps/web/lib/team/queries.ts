import 'server-only'

import { db } from '@/lib/db/client'
import { getSeatUsage, type AccountPlan, type SeatUsage } from '@/lib/team/seats'
import { accountInvites, users } from '@vantera/db'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'

export type TeamMemberRow = {
  id: string
  fullName: string
  email: string
  role: string
}

export type PendingInviteRow = {
  id: string
  email: string
  role: string
  invitedAt: string
  expiresAt: string
}

export type TeamOverview = {
  members: TeamMemberRow[]
  pendingInvites: PendingInviteRow[]
  seatUsage: SeatUsage
}

/** Everything the Team settings surface needs in one read. */
export async function getTeamOverview(
  accountId: string,
  plan: AccountPlan,
): Promise<TeamOverview> {
  const [members, invites, seatUsage] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.accountId, accountId), isNull(users.deletedAt)))
      .orderBy(asc(users.createdAt)),
    db
      .select({
        id: accountInvites.id,
        email: accountInvites.email,
        role: accountInvites.role,
        invitedAt: accountInvites.createdAt,
        expiresAt: accountInvites.expiresAt,
      })
      .from(accountInvites)
      .where(
        and(eq(accountInvites.accountId, accountId), eq(accountInvites.status, 'pending')),
      )
      .orderBy(desc(accountInvites.createdAt)),
    getSeatUsage(accountId, plan),
  ])

  return {
    members,
    pendingInvites: invites.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      invitedAt: new Date(row.invitedAt).toISOString(),
      expiresAt: new Date(row.expiresAt).toISOString(),
    })),
    seatUsage,
  }
}
