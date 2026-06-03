import { db } from '@/lib/db/client'
import { contacts, leads, messages, outreachCampaignSteps, sdrSequenceSteps } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'

export type OutboundMessageContext = {
  kind: 'message'
  accountId: string
  messageId: string
  contactId: string
  recordId: string | null
  contactFirstName: string
  contactLastName: string
  company: string | null
}

export type OutboundCampaignContext = {
  kind: 'campaign_step'
  accountId: string
  stepId: string
  campaignId: string
  leadId: string
  enrollmentId: string
}

export type OutboundSdrStepContext = {
  kind: 'sdr_step'
  accountId: string
  stepId: string
  sequenceId: string
  leadId: string
}

export type OutboundEmailContext =
  | OutboundMessageContext
  | OutboundCampaignContext
  | OutboundSdrStepContext

export async function findOutboundByResendId(
  resendId: string,
): Promise<OutboundEmailContext | null> {
  const [messageRow] = await db
    .select({ message: messages, contact: contacts })
    .from(messages)
    .innerJoin(contacts, eq(contacts.id, messages.contactId))
    .where(
      and(
        sql`${messages.metadata}->>'resendId' = ${resendId}`,
        isNull(messages.deletedAt),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  if (messageRow) {
    return {
      kind: 'message',
      accountId: messageRow.message.accountId,
      messageId: messageRow.message.id,
      contactId: messageRow.contact.id,
      recordId: messageRow.message.recordId,
      contactFirstName: messageRow.contact.firstName,
      contactLastName: messageRow.contact.lastName,
      company: messageRow.contact.company,
    }
  }

  const [step] = await db
    .select()
    .from(outreachCampaignSteps)
    .where(eq(outreachCampaignSteps.providerMessageId, resendId))
    .limit(1)

  if (step) {
    return {
      kind: 'campaign_step',
      accountId: step.accountId,
      stepId: step.id,
      campaignId: step.campaignId,
      leadId: step.leadId,
      enrollmentId: step.enrollmentId,
    }
  }

  const [sdrStep] = await db
    .select()
    .from(sdrSequenceSteps)
    .where(eq(sdrSequenceSteps.resendId, resendId))
    .limit(1)

  if (sdrStep) {
    return {
      kind: 'sdr_step',
      accountId: sdrStep.accountId,
      stepId: sdrStep.id,
      sequenceId: sdrStep.sequenceId,
      leadId: sdrStep.leadId,
    }
  }

  return null
}

export async function findLeadDisplayName(accountId: string, leadId: string): Promise<string> {
  const [lead] = await db
    .select({
      firstName: leads.firstName,
      lastName: leads.lastName,
      company: leads.company,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) return 'Prospect'
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Prospect'
}
