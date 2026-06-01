import { db } from '@/lib/db/client'
import { automations } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export async function getSystemAutomationId(
  accountId: string,
  ref: 'aspire' | 'draft' | 'lead_score',
): Promise<string> {
  const templateRef = `system:${ref}`

  const [existing] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(
      and(
        eq(automations.accountId, accountId),
        eq(automations.templateRef, templateRef),
        isNull(automations.deletedAt),
      ),
    )
    .limit(1)

  if (existing) return existing.id

  const [created] = await db
    .insert(automations)
    .values({
      accountId,
      name: `System: ${ref.replace('_', ' ')}`,
      triggerEvent: 'system',
      templateRef,
      isActive: true,
      triggerConditions: {},
      actions: [],
    })
    .returning({ id: automations.id })

  return created!.id
}
