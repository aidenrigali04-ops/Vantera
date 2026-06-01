import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  activities,
  aspireResults,
  automationRuns,
  leadScores,
  leads,
  messages,
} from '@vantera/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { schedules } from '@trigger.dev/sdk'

async function computeEngagementScore(accountId: string, leadId: string): Promise<number> {
  let score = 0

  const recentMessages = await db
    .select({ status: messages.status, sentAt: messages.sentAt })
    .from(messages)
    .where(
      and(
        eq(messages.accountId, accountId),
        sql`${messages.sentAt} > now() - interval '7 days'`,
      ),
    )
    .limit(20)

  if (recentMessages.some((m) => m.status === 'delivered' || m.status === 'sent')) {
    score += 20
  }

  const recentActivities = await db
    .select({ activityType: activities.activityType, createdAt: activities.createdAt })
    .from(activities)
    .where(
      and(
        eq(activities.accountId, accountId),
        eq(activities.leadId, leadId),
        sql`${activities.createdAt} > now() - interval '14 days'`,
      ),
    )

  if (recentActivities.some((a) => a.activityType === 'email_clicked')) score += 30
  if (recentActivities.some((a) => a.activityType === 'email_replied' || a.activityType === 'reply_detected')) {
    score += 40
  }
  if (recentActivities.length === 0) score = Math.max(0, score - 10)

  return Math.min(100, score)
}

export async function runDailyLeadScore(): Promise<{ accountsProcessed: number; leadsScored: number }> {
  const activeAccounts = await db
    .select({ id: accounts.id, plan: accounts.plan })
    .from(accounts)

  let accountsProcessed = 0
  let leadsScored = 0

  for (const account of activeAccounts) {
    const enabled = await evaluateFlag({
      accountId: account.id,
      plan: account.plan as Plan,
      flagName: 'lead_scoring',
    })
    if (!enabled) continue

    const openLeads = await db
      .select({ id: leads.id, company: leads.company, firstName: leads.firstName })
      .from(leads)
      .where(
        and(
          eq(leads.accountId, account.id),
          isNull(leads.deletedAt),
          isNull(leads.convertedContactId),
          sql`${leads.relationshipStatus} not in ('won', 'lost')`,
        ),
      )

    for (const lead of openLeads) {
      const [icpRow] = await db
        .select({ icpScore: aspireResults.icpScore })
        .from(aspireResults)
        .where(and(eq(aspireResults.accountId, account.id), eq(aspireResults.leadId, lead.id)))
        .orderBy(desc(aspireResults.createdAt))
        .limit(1)

      const icpScore = icpRow?.icpScore ?? 0
      const engagementScore = await computeEngagementScore(account.id, lead.id)
      const compositeScore = Math.round(icpScore * 0.6 + engagementScore * 0.4)

      const [previous] = await db
        .select({ compositeScore: leadScores.compositeScore })
        .from(leadScores)
        .where(and(eq(leadScores.accountId, account.id), eq(leadScores.leadId, lead.id)))
        .orderBy(desc(leadScores.scoredAt))
        .limit(1)

      await db.insert(leadScores).values({
        accountId: account.id,
        leadId: lead.id,
        icpScore,
        engagementScore,
        compositeScore,
        signals: { icpScore, engagementScore },
      })

      await db
        .update(leads)
        .set({ score: compositeScore, updatedAt: new Date() })
        .where(eq(leads.id, lead.id))

      leadsScored++

      if (previous && compositeScore - previous.compositeScore > 20) {
        await createIntelligenceSignal({
          accountId: account.id,
          signalType: 'score_increased',
          severity: 'yellow',
          headline: `${lead.firstName ?? 'Lead'}'s interest score jumped — follow up now`,
          actionLabel: 'View lead',
          actionPayload: { leadId: lead.id },
          expiresInDays: 3,
        })
      }

      if (compositeScore > 75 && engagementScore < 20) {
        await createIntelligenceSignal({
          accountId: account.id,
          signalType: 'high_icp_no_outreach',
          severity: 'yellow',
          headline: `High ICP match with no recent outreach — ${lead.company}`,
          actionLabel: 'Start outreach',
          actionPayload: { leadId: lead.id },
          expiresInDays: 7,
        })
      }
    }

    const automationId = await getSystemAutomationId(account.id, 'lead_score')
    await db.insert(automationRuns).values({
      accountId: account.id,
      automationId,
      triggerEvent: 'daily_lead_score',
      triggerPayload: {},
      actionType: 'score_leads',
      status: 'success',
      resultPayload: { leadsScored: openLeads.length },
    })

    accountsProcessed++
  }

  return { accountsProcessed, leadsScored }
}

export const dailyLeadScore = schedules.task({
  id: 'daily-lead-score',
  cron: '0 7 * * *',
  maxDuration: 900,
  run: async () => runDailyLeadScore(),
})
