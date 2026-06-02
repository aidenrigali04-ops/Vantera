import { draftOutreachMessages } from '@/lib/ai/draft-message'
import type { ApifyLead } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { isAiMessageDraftingEnabled } from '@/lib/ai/drafting-enabled'
import {
  isAutomaticOutreachMode,
  resolveOutreachAutomationMode,
} from '@/lib/sdr/outreach-automation'
import type { Plan } from '@/lib/feature-flags/flags'
import { sendCampaignEmail } from '@/lib/outreach/send-email'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import { accounts, automationRuns, leadDrafts, sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

export type DraftOnEnrollPayload = {
  accountId: string
  leadId: string
  apifyLead: ApifyLead
  icpScore: number
  icpSignals: string[]
}

export async function runDraftOnEnroll(payload: DraftOnEnrollPayload): Promise<{ draftIds: string[] }> {
  const [account] = await db
    .select({ name: accounts.name, vertical: accounts.vertical, plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, payload.accountId))
    .limit(1)

  if (!account) return { draftIds: [] }

  const aiDraftingEnabled = await isAiMessageDraftingEnabled(
    payload.accountId,
    account.plan as Plan,
  )

  if (!aiDraftingEnabled) return { draftIds: [] }

  const [sdrConfig] = await db
    .select({ outreachAutomationMode: sdrAgentConfigs.outreachAutomationMode })
    .from(sdrAgentConfigs)
    .where(eq(sdrAgentConfigs.accountId, payload.accountId))
    .limit(1)

  const mode = await resolveOutreachAutomationMode(
    payload.accountId,
    account.plan as Plan,
    sdrConfig?.outreachAutomationMode,
  )
  const autonomous = isAutomaticOutreachMode(mode)

  const person = payload.apifyLead
  const drafts = await draftOutreachMessages({
    accountId: payload.accountId,
    accountDisplayName: account.name,
    accountVertical: account.vertical,
    firstName: person.firstName,
    lastName: person.lastName,
    title: person.title,
    company: person.organizationName,
    industry: person.industry ?? '',
    email: person.email,
    phone: person.phone,
    employeeCount: person.employeeCount,
    technologies: person.technologies,
    icpScore: payload.icpScore,
    icpSignals: payload.icpSignals,
  })

  const draftIds: string[] = []
  const initialStatus = autonomous ? 'approved' : 'pending_review'

  for (const draft of drafts) {
    const [row] = await db
      .insert(leadDrafts)
      .values({
        accountId: payload.accountId,
        leadId: payload.leadId,
        channel: draft.channel,
        subject: draft.subject,
        body: draft.body,
        status: initialStatus,
        metadata: draft.metadata,
      })
      .returning({ id: leadDrafts.id })

    draftIds.push(row!.id)

    if (autonomous && draft.channel === 'email' && person.email) {
      const sent = await sendCampaignEmail({
        accountId: payload.accountId,
        accountName: account.name,
        toEmail: person.email,
        subject: draft.subject ?? 'Quick note',
        body: draft.body,
        lead: {
          firstName: person.firstName,
          lastName: person.lastName,
          company: person.organizationName,
          email: person.email,
          title: person.title,
        },
        stepId: row!.id,
      })

      if (sent.ok) {
        await db
          .update(leadDrafts)
          .set({ status: 'sent', sentAt: new Date() })
          .where(eq(leadDrafts.id, row!.id))

        await createIntelligenceSignal({
          accountId: payload.accountId,
          signalType: 'draft_sent',
          severity: 'green',
          headline: `Outreach sent to ${person.firstName} at ${person.organizationName}`,
          actionPayload: { draftId: row!.id, leadId: payload.leadId },
          expiresInDays: 7,
        })
      }
    } else if (!autonomous) {
      await createIntelligenceSignal({
        accountId: payload.accountId,
        signalType: 'draft_ready',
        severity: 'yellow',
        headline: `Draft ready — ${person.firstName} at ${person.organizationName}`,
        recommendation: 'Review and send when ready',
        actionLabel: 'Review draft',
        actionPayload: { draftId: row!.id, leadId: payload.leadId },
        expiresInDays: 7,
      })
    }
  }

  const automationId = await getSystemAutomationId(payload.accountId, 'draft')
  await db.insert(automationRuns).values({
    accountId: payload.accountId,
    automationId,
    triggerEvent: 'draft_on_enroll',
    triggerPayload: { leadId: payload.leadId },
    actionType: 'generate_drafts',
    status: 'success',
    resultPayload: { draftIds, autonomous },
  })

  return { draftIds }
}
