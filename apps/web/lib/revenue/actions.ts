'use server'

import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { requireAdminSession } from '@/lib/auth/require-session'
import { revalidatePath } from 'next/cache'

export async function saveRevenueGoal(input: {
  mrrGoal: number
  avgClientValue: number | null
}) {
  const session = await requireAdminSession()

  const mrrGoal = Math.max(0, Math.round(Number(input.mrrGoal) || 0))
  const avgClientValue =
    input.avgClientValue != null && Number.isFinite(input.avgClientValue)
      ? Math.max(0, Math.round(input.avgClientValue))
      : null

  await db
    .update(accounts)
    .set({ mrrGoal, avgClientValue })
    .where(eq(accounts.id, session.accountId))

  revalidatePath('/admin/dashboard')
  return { success: true as const }
}
