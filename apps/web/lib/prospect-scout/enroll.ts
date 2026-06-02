import type { ApolloPersonResult } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import type { DraftSdrSequencePayload } from '@/lib/sdr/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  aspireResults,
  automationRuns,
  leads,
  sdrAgentConfigs,
  sdrSequences,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { tasks } from '@trigger.dev/sdk'
import { runDraftSdrSequence } from '@/lib/sdr/run-draft-sequence'
import type { EnrollProspectResult, SdrConfigRow } from '@/lib/prospect-scout/types'

function domainFromEmail(email: string | null): string | null {
  if (!email) return null
  return email.split('@')[1]?.toLowerCase() ?? null
}

async function upsertLeadFromApollo(
  accountId: string,
  person: ApolloPersonResult,
  score: number,
  signals: string[],
  source: 'sdr_agent' | 'aspire',
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
      source,
      score,
      enrichment: { apolloId: person.id, icpSignals: signals, industry: person.industry },
    })
    .returning({ id: leads.id })

  return created!.id
}

export async function enrollProspect(input: {
  accountId: string
  config: SdrConfigRow
  person: ApolloPersonResult
  searchId: string
  icpScore: number
  icpSignals: string[]
  startSdrSequence: boolean
  accountName?: string
}): Promise<EnrollProspectResult> {
  const { accountId, config, person, searchId, icpScore, icpSignals, startSdrSequence } = input

  const leadId = await upsertLeadFromApollo(
    accountId,
    person,
    icpScore,
    icpSignals,
    startSdrSequence ? 'sdr_agent' : 'aspire',
  )

  const [aspireRow] = await db
    .insert(aspireResults)
    .values({
      accountId,
      searchId: searchId || null,
      apolloId: person.id,
      rawData: person,
      icpScore,
      icpSignals,
      leadId,
      status: startSdrSequence ? 'enrolled' : 'found',
      enrolledAt: startSdrSequence ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [aspireResults.accountId, aspireResults.apolloId],
      set: {
        searchId,
        leadId,
        icpScore,
        icpSignals,
        status: startSdrSequence ? 'enrolled' : 'found',
        enrolledAt: startSdrSequence ? new Date() : null,
      },
    })
    .returning({ id: aspireResults.id })

  let sequenceId: string | undefined

  if (startSdrSequence && config.isActive && !config.isPaused) {
    const [sequence] = await db
      .insert(sdrSequences)
      .values({
        accountId,
        configId: config.id,
        leadId,
        aspireResultId: aspireRow!.id,
        status: 'active',
      })
      .returning({ id: sdrSequences.id })

    sequenceId = sequence!.id

    await logSdrActivity({
      accountId,
      configId: config.id,
      leadId,
      sequenceId,
      eventType: 'lead_enrolled',
      metadata: { icpScore, company: person.organizationName, searchId, source: 'prospect_scout' },
    })

    const payload: DraftSdrSequencePayload = {
      accountId,
      configId: config.id,
      sequenceId,
      leadId,
      aspireResultId: aspireRow!.id,
    }

    try {
      await tasks.trigger('sdr-lead-profiler', payload)
    } catch {
      try {
        await runDraftSdrSequence(payload)
      } catch (error) {
        console.error('[prospect-scout] lead profiler failed:', error)
      }
    }

    await db
      .update(sdrAgentConfigs)
      .set({
        totalLeadsFound: config.totalLeadsFound + 1,
        updatedAt: new Date(),
      })
      .where(eq(sdrAgentConfigs.id, config.id))
  }

  return {
    leadId,
    aspireResultId: aspireRow!.id,
    sequenceId,
    enrolled: Boolean(sequenceId),
  }
}

export async function recordFoundProspects(input: {
  accountId: string
  searchId: string
  people: Array<{ person: ApolloPersonResult; icpScore: number; icpSignals: string[] }>
}): Promise<number> {
  if (input.people.length === 0) return 0

  for (const { person, icpScore, icpSignals } of input.people) {
    await db
      .insert(aspireResults)
      .values({
        accountId: input.accountId,
        searchId: input.searchId,
        apolloId: person.id,
        rawData: person,
        icpScore,
        icpSignals,
        status: 'found',
      })
      .onConflictDoNothing({ target: [aspireResults.accountId, aspireResults.apolloId] })
  }

  return input.people.length
}

export async function notifyIcpMatches(
  accountId: string,
  searchName: string,
  count: number,
  searchId: string,
): Promise<void> {
  if (count <= 0) return
  await createIntelligenceSignal({
    accountId,
    signalType: 'aspire_icp_match',
    severity: 'yellow',
    headline: `${count} new ICP leads found in ${searchName}`,
    actionLabel: 'Review matches',
    actionPayload: { searchId },
    expiresInDays: 7,
  })
}

export { domainFromEmail }
