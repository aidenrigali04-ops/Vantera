import type { ProspectLead } from '@/lib/aspire/types'
import {
  buildLeadProspectEnrichment,
  mergeLeadEnrichment,
} from '@/lib/leads/enrichment'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import {
  type SdrCreditAction,
} from '@/lib/sdr/credit-types'
import {
  consumeSdrCredits,
  SdrCreditsExhaustedError,
} from '@/lib/sdr/credits'
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
import { and, eq, isNull, sql } from 'drizzle-orm'
import { tasks } from '@trigger.dev/sdk'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { runDraftSdrSequence } from '@/lib/sdr/run-draft-sequence'
import type { EnrollProspectResult, SdrConfigRow } from '@/lib/prospect-scout/types'

function domainFromEmail(email: string | null): string | null {
  if (!email) return null
  return email.split('@')[1]?.toLowerCase() ?? null
}

async function upsertLeadFromApify(
  accountId: string,
  person: ProspectLead,
  score: number,
  signals: string[],
  source: 'sdr_agent' | 'aspire',
): Promise<string> {
  if (person.email) {
    const [existing] = await db
      .select({ id: leads.id, enrichment: leads.enrichment })
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
      const enrichment = buildLeadProspectEnrichment(
        person,
        score,
        signals,
        source === 'sdr_agent' ? 'scout' : 'aspire',
      )
      await db
        .update(leads)
        .set({
          score,
          avatarUrl: person.photoUrl,
          enrichment: mergeLeadEnrichment(
            existing.enrichment as Record<string, unknown>,
            enrichment,
          ),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id))
      return existing.id
    }
  }

  const enrichment = buildLeadProspectEnrichment(
    person,
    score,
    signals,
    source === 'sdr_agent' ? 'scout' : 'aspire',
  )

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
      avatarUrl: person.photoUrl,
      source,
      score,
      enrichment,
    })
    .returning({ id: leads.id })

  return created!.id
}

export async function enrollProspect(input: {
  accountId: string
  config: SdrConfigRow
  person: ProspectLead
  searchId: string | null
  icpScore: number
  icpSignals: string[]
  startSdrSequence: boolean
  /** When false without sequence, still tag as scout-sourced pipeline lead (not manual Aspire). */
  pipelineOnlyFromScout?: boolean
  accountName?: string
  /** Caller already charged credits (e.g. pipeline enroll API). */
  skipCreditCharge?: boolean
  sdrCreditAction?: SdrCreditAction
}): Promise<EnrollProspectResult> {
  const { accountId, config, person, icpScore, icpSignals, startSdrSequence } = input
  const searchId = input.searchId || null

  const isSdrEnroll = startSdrSequence || Boolean(input.pipelineOnlyFromScout)
  if (isSdrEnroll && !input.skipCreditCharge) {
    const action =
      input.sdrCreditAction ??
      (input.pipelineOnlyFromScout && !startSdrSequence ? 'pipeline_enroll' : 'scout_enroll')
    await consumeSdrCredits(accountId, action, person.id)
  }

  const leadSource = startSdrSequence
    ? 'sdr_agent'
    : input.pipelineOnlyFromScout
      ? 'sdr_agent'
      : 'aspire'

  const leadId = await upsertLeadFromApify(
    accountId,
    person,
    icpScore,
    icpSignals,
    leadSource,
  )

  const [aspireRow] = await db
    .insert(aspireResults)
    .values({
      accountId,
      searchId: searchId || null,
      apifyId: person.id,
      rawData: person,
      icpScore,
      icpSignals,
      leadId,
      status: startSdrSequence ? 'enrolled' : 'found',
      enrolledAt: startSdrSequence ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [aspireResults.accountId, aspireResults.apifyId],
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
        status: 'drafting',
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

    let drafted = false
    const automaticOutreach = await isAccountAutomaticOutreach(accountId)

    if (automaticOutreach) {
      try {
        await runDraftSdrSequence(payload)
        drafted = true
      } catch (error) {
        console.error('[prospect-scout] automatic sequence draft failed:', error)
      }
    } else {
      try {
        await tasks.trigger('sdr-lead-profiler', payload)
        drafted = true
      } catch {
        try {
          await runDraftSdrSequence(payload)
          drafted = true
        } catch (error) {
          console.error('[prospect-scout] lead profiler failed:', error)
        }
      }
    }

    if (!drafted) {
      await db
        .update(sdrSequences)
        .set({ status: 'failed' })
        .where(eq(sdrSequences.id, sequenceId))
      sequenceId = undefined
    }

    await db
      .update(sdrAgentConfigs)
      .set({
        totalLeadsFound: config.totalLeadsFound + 1,
        updatedAt: new Date(),
      })
      .where(eq(sdrAgentConfigs.id, config.id))
  } else if (input.pipelineOnlyFromScout && leadId) {
    await db
      .update(aspireResults)
      .set({
        leadId,
        status: 'enrolled',
        enrolledAt: new Date(),
      })
      .where(eq(aspireResults.id, aspireRow!.id))

    await logSdrActivity({
      accountId,
      configId: config.id,
      leadId,
      eventType: 'lead_enrolled',
      metadata: {
        icpScore,
        company: person.organizationName,
        searchId,
        source: 'prospect_scout',
        pipelineOnly: true,
      },
    })
  }

  return {
    leadId,
    aspireResultId: aspireRow!.id,
    sequenceId,
    enrolled: Boolean(sequenceId) || Boolean(input.pipelineOnlyFromScout && leadId),
  }
}

export async function recordFoundProspects(input: {
  accountId: string
  /** null = Prospect Scout pool (not tied to a saved Aspire search) */
  searchId: string | null
  people: Array<{ person: ProspectLead; icpScore: number; icpSignals: string[] }>
}): Promise<number> {
  if (input.people.length === 0) return 0

  const searchId = input.searchId ?? null
  for (const { person, icpScore, icpSignals } of input.people) {
    await db
      .insert(aspireResults)
      .values({
        accountId: input.accountId,
        searchId,
        apifyId: person.id,
        rawData: person,
        icpScore,
        icpSignals,
        status: 'found',
      })
      .onConflictDoUpdate({
        target: [aspireResults.accountId, aspireResults.apifyId],
        set: {
          rawData: person,
          icpScore,
          icpSignals,
          searchId: sql`coalesce(excluded.search_id, ${aspireResults.searchId})`,
        },
      })
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
    headline: `${count} new ICP-matched prospects from ${searchName}`,
    actionLabel: 'View pipeline',
    actionPayload: { searchId, source: 'prospect_scout', href: '/admin/crm/pipeline' },
    expiresInDays: 7,
  })
}

export { domainFromEmail, SdrCreditsExhaustedError }
