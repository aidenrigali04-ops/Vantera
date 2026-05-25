import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { findUsersForAccount } from '@/lib/db/queries'
import { contacts, records, stageDefinitions, users } from '@vantera/db'
import { and, eq, gte, isNull, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const weekStartParam = searchParams.get('weekStart')
  const userId = searchParams.get('userId') ?? undefined

  const weekStart = weekStartParam ? new Date(weekStartParam) : startOfWeek(new Date())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const scheduledConditions = [
    eq(records.accountId, session.accountId),
    isNull(records.deletedAt),
    gte(records.scheduledAt, weekStart),
    lte(records.scheduledAt, weekEnd),
  ]

  if (userId) {
    scheduledConditions.push(eq(records.assignedUserId, userId))
  }

  const scheduledRows = await db
    .select()
    .from(records)
    .where(and(...scheduledConditions))

  const scheduled = await Promise.all(
    scheduledRows.map(async (record) => {
      const [contact] = await db
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, phone: contacts.phone })
        .from(contacts)
        .where(eq(contacts.id, record.contactId))
        .limit(1)
      const [stage] = await db
        .select({ label: stageDefinitions.label, color: stageDefinitions.color })
        .from(stageDefinitions)
        .where(eq(stageDefinitions.id, record.stageId))
        .limit(1)
      let assignedUser = null
      if (record.assignedUserId) {
        const [u] = await db
          .select({ fullName: users.fullName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, record.assignedUserId))
          .limit(1)
        assignedUser = u ?? null
      }
      return { ...record, contact: contact ?? null, stage: stage ?? null, assignedUser }
    }),
  )

  const unscheduled = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.accountId, session.accountId),
        isNull(records.deletedAt),
        isNull(records.completedAt),
        isNull(records.scheduledAt),
      ),
    )
    .orderBy(records.createdAt)
    .limit(50)

  const accountUsers = await findUsersForAccount(session.accountId)

  return NextResponse.json({
    success: true,
    data: {
      scheduled,
      unscheduled,
      users: accountUsers,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    },
  })
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
