import { schedules, task } from '@trigger.dev/sdk'
import { db } from '@/lib/db/client'
import { activities, linkedinSequenceSteps } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { findPendingSteps } from '@/lib/linkedin/queries'

export const linkedinSequenceRunner = schedules.task({
  id: 'linkedin-sequence-runner',
  cron: '0 9 * * *',
  run: async () => {
    // MVP: mark pending steps as sent and log activity
    // TODO: wire Chrome extension / LinkedIn API for real sends
    const accountIds = process.env.DEBUG_TEST_ACCOUNT_ID_TEAM
      ? [process.env.DEBUG_TEST_ACCOUNT_ID_TEAM]
      : []

    let processed = 0
    for (const accountId of accountIds) {
      const steps = await findPendingSteps(accountId, 50)
      for (const step of steps) {
        await db
          .update(linkedinSequenceSteps)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(linkedinSequenceSteps.id, step.id))

        await db.insert(activities).values({
          accountId,
          leadId: step.leadId,
          actorType: 'automation',
          actorId: accountId,
          activityType: 'connection_sent',
          body: 'LinkedIn sequence step processed',
          metadata: { stepId: step.id },
        })
        processed++
      }
    }

    return { processed }
  },
})

export const aspireEnrichmentSync = schedules.task({
  id: 'aspire-enrichment-sync',
  cron: '0 6 * * *',
  run: async () => {
    // TODO: refresh enrichment cache from Apify/Clay
    return { refreshed: 0, message: 'Aspire enrichment sync stub' }
  },
})

export const linkedinSequenceRunnerTask = task({
  id: 'linkedin-sequence-runner-manual',
  run: async (payload: { accountId: string }) => {
    const steps = await findPendingSteps(payload.accountId, 100)
    return { pending: steps.length }
  },
})
