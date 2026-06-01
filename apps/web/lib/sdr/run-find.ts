import { callModel, parseJsonResponse } from '@/lib/ai/client'
import type { ApolloPersonResult } from '@/lib/aspire/types'
import { scoreICP } from '@/lib/aspire/icp-score'
import { filterExistingLeads, searchApollo } from '@/lib/aspire/search'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { requireSDREnabledForAccount } from '@/lib/sdr/guard'
import {
  countActiveSdrSequences,
  countSdrEnrolledToday,
} from '@/lib/sdr/queries'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import {
  accounts,
  aspireResults,
  automationRuns,
  featureFlags,
  leads,
  sdrAgentConfigs,
  sdrSequences,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { tasks } from '@trigger.dev/sdk'
import type { DraftSdrSequencePayload } from '@/lib/sdr/types'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function domainFromEmail(email: string | null): string | null {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ?? null
}

function buildApolloFilters(config: typeof sdrAgentConfigs.$inferSelect) {
  const icp = config.icpConfig as {
    targetTitles?: string[]
    targetIndustries?: string[]
    targetSizes?: [number, number]
  }

  return {
    jobTitles: icp.targetTitles ?? ['Owner', 'CEO', 'Founder'],
    industries: config.targetVerticals.length
      ? config.targetVerticals
      : (icp.targetIndustries ?? []),
    companySizeRanges: icp.targetSizes
      ? [`${icp.targetSizes[0]},${icp.targetSizes[1]}`]
      : ['1,200'],
    locations: config.targetCities ?? [],
  }
}

export async function runSdrAgentFind(): Promise<{ accountsRun: number; leadsEnrolled: number }> {
  const configs = await db
    .select({
      config: sdrAgentConfigs,
      plan: accounts.plan,
      vertical: accounts.vertical,
      accountName: accounts.name,
    })
    .from(sdrAgentConfigs)
    .innerJoin(accounts, eq(sdrAgentConfigs.accountId, accounts.id))
    .where(
      and(
        eq(sdrAgentConfigs.isActive, true),
        eq(sdrAgentConfigs.isPaused, false),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )

  let accountsRun = 0
  let leadsEnrolled = 0

  for (const { config, plan, vertical, accountName } of configs) {
    try {
      await requireSDREnabledForAccount(config.accountId, plan as Plan)
    } catch {
      continue
    }

    const activeCount = await countActiveSdrSequences(config.accountId)
    if (activeCount >= config.maxActiveLeads) continue

    const enrolledToday = await countSdrEnrolledToday(config.accountId)
    const headroom = Math.min(
      config.maxNewLeadsDay - enrolledToday,
      config.maxActiveLeads - activeCount,
    )
    if (headroom <= 0) continue

    const filters = buildApolloFilters(config)
    const icpConfig = config.icpConfig as Parameters<typeof scoreICP>[1]

    try {
      const { people } = await searchApollo(filters, 1, 25)
      const existingIds = new Set(await filterExistingLeads(config.accountId, people.map((p) => p.id)))
      const excludeDomains = new Set((config.excludeDomains ?? []).map((d) => d.toLowerCase()))

      const candidates = people
        .filter((p) => !existingIds.has(p.id))
        .filter((p) => {
          const domain = domainFromEmail(p.email)
          return !domain || !excludeDomains.has(domain)
        })
        .map((person) => ({
          person,
          icp: scoreICP(person, icpConfig),
        }))
        .sort((a, b) => b.icp.score - a.icp.score)
        .slice(0, headroom)

      for (const { person, icp } of candidates) {
        const leadId = await upsertLeadFromApollo(config.accountId, person, icp.score, icp.signals)

        const [aspireRow] = await db
          .insert(aspireResults)
          .values({
            accountId: config.accountId,
            apolloId: person.id,
            rawData: person,
            icpScore: icp.score,
            icpSignals: icp.signals,
            leadId,
            status: 'enrolled',
            enrolledAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [aspireResults.accountId, aspireResults.apolloId],
            set: {
              leadId,
              icpScore: icp.score,
              icpSignals: icp.signals,
              status: 'enrolled',
              enrolledAt: new Date(),
            },
          })
          .returning({ id: aspireResults.id })

        const [sequence] = await db
          .insert(sdrSequences)
          .values({
            accountId: config.accountId,
            configId: config.id,
            leadId,
            aspireResultId: aspireRow!.id,
            status: 'active',
          })
          .returning({ id: sdrSequences.id })

        await logSdrActivity({
          accountId: config.accountId,
          configId: config.id,
          leadId,
          sequenceId: sequence!.id,
          eventType: 'lead_enrolled',
          metadata: { icpScore: icp.score, company: person.organizationName },
        })

        const payload: DraftSdrSequencePayload = {
          accountId: config.accountId,
          configId: config.id,
          sequenceId: sequence!.id,
          leadId,
          aspireResultId: aspireRow!.id,
        }

        try {
          await tasks.trigger('draft-sdr-sequence', payload)
        } catch {
          // Trigger unavailable in dev — draft job can be invoked manually
        }

        leadsEnrolled += 1
      }

      await db
        .update(sdrAgentConfigs)
        .set({
          totalLeadsFound: config.totalLeadsFound + candidates.length,
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sdrAgentConfigs.id, config.id))

      const automationId = await getSystemAutomationId(config.accountId, 'sdr_find')
      await db.insert(automationRuns).values({
        accountId: config.accountId,
        automationId,
        triggerEvent: 'sdr_agent_find',
        actionType: 'lead_discovery',
        status: 'success',
        resultPayload: { enrolled: candidates.length, accountName },
      })

      accountsRun += 1
    } catch (error) {
      console.error('[sdr-agent-find] account failed:', config.accountId, error)
    }

    await sleep(300)
  }

  return { accountsRun, leadsEnrolled }
}

async function upsertLeadFromApollo(
  accountId: string,
  person: ApolloPersonResult,
  score: number,
  signals: string[],
): Promise<string> {
  if (person.email) {
    const [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.accountId, accountId),
          eq(leads.email, person.email),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(leads)
        .set({ score, updatedAt: new Date() })
        .where(eq(leads.id, existing.id))
      return existing.id
    }
  }

  const [created] = await db
    .insert(leads)
    .values({
      accountId,
      firstName: person.firstName,
      lastName: person.lastName,
      title: person.title,
      company: person.organizationName,
      email: person.email,
      phone: person.phone,
      linkedinUrl: person.linkedinUrl,
      source: 'sdr_agent',
      score,
      enrichment: { apolloId: person.id, icpSignals: signals, industry: person.industry },
    })
    .returning({ id: leads.id })

  return created!.id
}

export async function isSdrFlagEnabled(accountId: string, plan: Plan): Promise<boolean> {
  const [row] = await db
    .select({ isEnabled: featureFlags.isEnabled })
    .from(featureFlags)
    .where(and(eq(featureFlags.accountId, accountId), eq(featureFlags.flagName, 'sdr_agent_enabled')))
    .limit(1)

  if (row) return row.isEnabled
  return evaluateFlag({ accountId, plan, flagName: 'sdr_agent_enabled' })
}

export type { SdrOutreachWindow }
