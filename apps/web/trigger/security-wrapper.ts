import { db } from '@/lib/db/client'
import { accounts, automationRuns } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const BaseJobPayload = z.object({
  account_id: z.string().uuid('account_id must be a valid UUID'),
  triggered_by: z.enum(['system', 'user', 'webhook', 'cron']).optional().default('system'),
})

export async function validateJobPayload<T>(schema: z.ZodSchema<T>, payload: unknown): Promise<T> {
  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new Error(`[Job] Invalid payload: ${JSON.stringify(result.error.flatten())}`)
  }
  return result.data
}

export async function assertAccountActive(accountId: string): Promise<void> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!row) {
    throw new Error(`[Job] Account ${accountId} not found or inactive`)
  }
}

export async function createAutomationRun(params: {
  account_id: string
  automation_id: string
  trigger_event: string
  trigger_payload: Record<string, unknown>
  action_type: string
}): Promise<string> {
  const [row] = await db
    .insert(automationRuns)
    .values({
      accountId: params.account_id,
      automationId: params.automation_id,
      triggerEvent: params.trigger_event,
      triggerPayload: params.trigger_payload,
      actionType: params.action_type,
      status: 'running',
    })
    .returning({ id: automationRuns.id })

  if (!row?.id) {
    throw new Error('[Job] Failed to create automation_run')
  }

  return row.id
}

export async function completeAutomationRun(
  runId: string,
  success: boolean,
  resultPayload?: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  await db
    .update(automationRuns)
    .set({
      status: success ? 'success' : 'failed',
      resultPayload: resultPayload ?? {},
      errorMessage: errorMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(automationRuns.id, runId))
}
