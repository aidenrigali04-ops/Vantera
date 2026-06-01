'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { intelligenceSignals } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function dismissEmbeddedInsight(signalId: string): Promise<ActionResult> {
  if (signalId.startsWith('derived-')) {
    return { success: true, data: undefined }
  }

  const session = await requireAdminSession()

  const [updated] = await db
    .update(intelligenceSignals)
    .set({
      isDismissed: true,
      dismissedByUserId: session.userId,
    })
    .where(
      and(
        eq(intelligenceSignals.id, signalId),
        eq(intelligenceSignals.accountId, session.accountId),
      ),
    )
    .returning({ id: intelligenceSignals.id })

  if (!updated) {
    return { success: false, error: 'Insight not found' }
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/clients')
  revalidatePath('/admin/pipeline')
  revalidatePath('/admin/ai-brain')

  return { success: true, data: undefined }
}
