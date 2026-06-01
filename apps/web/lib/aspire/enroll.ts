import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { EnrollError } from '@/lib/aspire/enroll-error'
import type { ApolloPersonResult, EnrollResult } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  activities,
  aspireResults,
  automationRuns,
  leads,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

async function resolveSessionContext() {
  const session = await getAdminSession()
  if (!session) throw new EnrollError('UNAUTHORIZED', 'Your session expired. Refresh and sign in again.')
  return session
}

async function findExistingResult(accountId: string, apolloId: string) {
  const [row] = await db
    .select()
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        eq(aspireResults.apolloId, apolloId),
        isNull(aspireResults.deletedAt),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function enrollLeadFromAspire(
  apolloResult: ApolloPersonResult,
  searchId: string,
  pipelineStage = 'prospect',
): Promise<EnrollResult> {
  const session = await resolveSessionContext()
  const accountId = session.accountId

  const existing = await findExistingResult(accountId, apolloResult.id)
  if (existing?.status === 'added_to_crm' || existing?.status === 'enrolled') {
    throw new EnrollError('ALREADY_ENROLLED', 'This prospect is already in your pipeline')
  }

  const [account] = await db
    .select({ vertical: accounts.vertical, name: accounts.name, plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const icpConfig = getIcpConfigForVertical(account?.vertical ?? 'agency')
  const icp = scoreICP(apolloResult, icpConfig)

  let leadId: string

  if (apolloResult.email) {
    const [existingLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.accountId, accountId),
          eq(leads.email, apolloResult.email),
          isNull(leads.deletedAt),
        ),
      )
      .limit(1)

    if (existingLead) {
      leadId = existingLead.id
    } else {
      const [created] = await db
        .insert(leads)
        .values({
          accountId,
          firstName: apolloResult.firstName,
          lastName: apolloResult.lastName,
          title: apolloResult.title,
          company: apolloResult.organizationName,
          email: apolloResult.email,
          phone: apolloResult.phone,
          linkedinUrl: apolloResult.linkedinUrl,
          source: 'aspire',
          score: icp.score,
          ownerId: session.userId,
          pipelineStage,
          enrichment: {
            industry: apolloResult.industry,
            apolloId: apolloResult.id,
            icpSignals: icp.signals,
          },
        })
        .returning({ id: leads.id })
      leadId = created!.id
    }
  } else {
    const [created] = await db
      .insert(leads)
      .values({
        accountId,
        firstName: apolloResult.firstName,
        lastName: apolloResult.lastName,
        title: apolloResult.title,
        company: apolloResult.organizationName,
        phone: apolloResult.phone,
        linkedinUrl: apolloResult.linkedinUrl,
        source: 'aspire',
        score: icp.score,
        ownerId: session.userId,
        pipelineStage,
        enrichment: {
          industry: apolloResult.industry,
          apolloId: apolloResult.id,
          icpSignals: icp.signals,
        },
      })
      .returning({ id: leads.id })
    leadId = created!.id
  }

  if (existing) {
    await db
      .update(aspireResults)
      .set({
        leadId,
        status: 'added_to_crm',
        enrolledAt: new Date(),
        icpScore: icp.score,
        icpSignals: icp.signals,
      })
      .where(and(eq(aspireResults.id, existing.id), eq(aspireResults.accountId, accountId)))
  } else {
    await db.insert(aspireResults).values({
      accountId,
      searchId: searchId || null,
      leadId,
      apolloId: apolloResult.id,
      rawData: apolloResult,
      icpScore: icp.score,
      icpSignals: icp.signals,
      status: 'added_to_crm',
      enrolledAt: new Date(),
    })
  }

  await db.insert(activities).values({
    accountId,
    leadId,
    actorType: 'system',
    actorId: session.userId,
    activityType: 'aspire_enrolled',
    body: `Added ${apolloResult.firstName} ${apolloResult.lastName} from Aspire`,
    metadata: { apolloId: apolloResult.id, searchId, icpScore: icp.score },
    visibleToClient: false,
  })

  const leadScoringEnabled = await evaluateFlag({
    accountId,
    plan: (account?.plan ?? 'team') as Plan,
    flagName: 'lead_scoring',
  })

  if (leadScoringEnabled) {
    await createIntelligenceSignal({
      accountId,
      signalType: 'draft_pending',
      severity: 'green',
      headline: `Draft being generated for ${apolloResult.firstName} at ${apolloResult.organizationName}`,
      actionPayload: { leadId, apolloId: apolloResult.id },
      expiresInDays: 7,
    })
  }

  let jobId: string | null = null
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3')
    const handle = await tasks.trigger('draft-on-enroll', {
      accountId,
      contactId: leadId,
      recordId: leadId,
      leadId,
      apolloData: apolloResult,
      icpScore: icp.score,
      icpSignals: icp.signals,
    })
    jobId = handle.id
  } catch (error) {
    console.warn('[enrollLeadFromAspire] Trigger.dev unavailable, running inline:', error)
    const { runDraftOnEnroll } = await import('@/lib/aspire/draft-on-enroll-runner')
    await runDraftOnEnroll({
      accountId,
      leadId,
      apolloData: apolloResult,
      icpScore: icp.score,
      icpSignals: icp.signals,
    })
  }

  const automationId = await getSystemAutomationId(accountId, 'aspire')
  await db.insert(automationRuns).values({
    accountId,
    automationId,
    triggerEvent: 'aspire_enrolled',
    triggerPayload: { leadId, apolloId: apolloResult.id },
    actionType: 'draft_on_enroll',
    status: 'success',
    resultPayload: { jobId },
  })

  return {
    contactId: leadId,
    recordId: leadId,
    leadId,
    draftIds: [],
    icpScore: icp.score,
    jobId,
  }
}

async function findLeadIdForAspirePerson(
  accountId: string,
  person: ApolloPersonResult,
): Promise<string | null> {
  if (person.id) {
    const [byApollo] = await db
      .select({ leadId: aspireResults.leadId })
      .from(aspireResults)
      .where(
        and(
          eq(aspireResults.accountId, accountId),
          eq(aspireResults.apolloId, person.id),
          isNull(aspireResults.deletedAt),
        ),
      )
      .limit(1)
    if (byApollo?.leadId) return byApollo.leadId
  }

  if (person.email) {
    const [byEmail] = await db
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
    if (byEmail) return byEmail.id
  }

  return null
}

export async function bulkEnrollFromAspire(
  apolloResults: ApolloPersonResult[],
  searchId: string,
  pipelineStage = 'prospect',
): Promise<{ enrolled: number; skipped: number; errors: number; leadIds: string[] }> {
  const session = await getAdminSession()
  if (!session) throw new EnrollError('UNAUTHORIZED', 'Your session expired')

  let enrolled = 0
  let skipped = 0
  let errors = 0
  const leadIds: string[] = []

  for (const person of apolloResults) {
    try {
      const result = await enrollLeadFromAspire(person, searchId, pipelineStage)
      leadIds.push(result.leadId)
      enrolled++
    } catch (error) {
      if (error instanceof EnrollError && error.code === 'ALREADY_ENROLLED') {
        skipped++
        const existingId = await findLeadIdForAspirePerson(session.accountId, person)
        if (existingId) leadIds.push(existingId)
      } else {
        errors++
        console.error('[bulkEnrollFromAspire]', error)
      }
    }
  }

  return { enrolled, skipped, errors, leadIds: [...new Set(leadIds)] }
}
