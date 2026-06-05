import { db } from '@/lib/db/client'
import type {
  EmailDraftItem,
  LinkedInDraftItem,
  MessageDrafterPayload,
  MessageDrafterStats,
} from '@/lib/message-drafter/types'
import { resolveOutboundCopy } from '@/lib/outreach/types'
import {
  leadDrafts,
  leads,
  outreachCampaignSteps,
  outreachCampaigns,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'

export async function findPendingEmailDrafts(accountId: string): Promise<EmailDraftItem[]> {
  const rows = await db
    .select({ draft: leadDrafts, lead: leads })
    .from(leadDrafts)
    .innerJoin(leads, eq(leadDrafts.leadId, leads.id))
    .where(
      and(
        eq(leadDrafts.accountId, accountId),
        eq(leadDrafts.status, 'pending_review'),
        inArray(leadDrafts.channel, ['email', 'sms']),
        isNull(leadDrafts.deletedAt),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(leadDrafts.createdAt))

  return rows.map(({ draft, lead }) => ({
    id: draft.id,
    channel: draft.channel as 'email' | 'sms',
    subject: draft.subject,
    body: draft.body,
    draftedBy: draft.draftedBy,
    createdAt: draft.createdAt,
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
    },
    metadata: (draft.metadata as Record<string, unknown>) ?? {},
  }))
}

export async function findPendingLinkedInDrafts(accountId: string): Promise<LinkedInDraftItem[]> {
  const campaignRows = await db
    .select({
      step: outreachCampaignSteps,
      lead: leads,
      campaign: outreachCampaigns,
    })
    .from(outreachCampaignSteps)
    .innerJoin(leads, eq(outreachCampaignSteps.leadId, leads.id))
    .innerJoin(outreachCampaigns, eq(outreachCampaignSteps.campaignId, outreachCampaigns.id))
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        eq(outreachCampaignSteps.channel, 'linkedin'),
        eq(outreachCampaignSteps.status, 'pending'),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
        isNull(outreachCampaigns.deletedAt),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(outreachCampaignSteps.sendAt))

  const sdrRows = await db
    .select({
      step: sdrSequenceSteps,
      lead: leads,
      sequence: sdrSequences,
    })
    .from(sdrSequenceSteps)
    .innerJoin(leads, eq(sdrSequenceSteps.leadId, leads.id))
    .innerJoin(sdrSequences, eq(sdrSequenceSteps.sequenceId, sdrSequences.id))
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.channel, 'linkedin'),
        eq(sdrSequenceSteps.status, 'scheduled'),
        lte(sdrSequenceSteps.scheduledFor, new Date()),
        isNull(sdrSequenceSteps.deletedAt),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(sdrSequenceSteps.scheduledFor))

  const campaignItems: LinkedInDraftItem[] = campaignRows.map(({ step, lead, campaign }) => {
    const metadata = step.metadata as { message?: string } | null
    const body =
      metadata?.message ??
      resolveOutboundCopy(step.body, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        email: lead.email,
        title: lead.title,
      })

    return {
      id: step.id,
      source: 'campaign',
      stepIndex: step.stepIndex,
      body,
      scheduledFor: step.sendAt,
      campaignName: campaign.name,
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        linkedinUrl: lead.linkedinUrl,
      },
    }
  })

  const sdrItems: LinkedInDraftItem[] = sdrRows.map(({ step, lead, sequence }) => ({
    id: step.id,
    source: 'sdr_sequence',
    stepIndex: step.stepNumber - 1,
    body: step.body,
    scheduledFor: step.scheduledFor,
    campaignName: `SDR sequence · ${sequence.status}`,
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      linkedinUrl: lead.linkedinUrl,
    },
  }))

  return [...campaignItems, ...sdrItems].sort(
    (a, b) => b.scheduledFor.getTime() - a.scheduledFor.getTime(),
  )
}

export async function getMessageDrafterStats(
  accountId: string,
  emailPending: number,
  linkedInPending: number,
): Promise<MessageDrafterStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [sentStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadDrafts)
    .where(
      and(
        eq(leadDrafts.accountId, accountId),
        eq(leadDrafts.status, 'sent'),
        gte(leadDrafts.sentAt, weekAgo),
        isNull(leadDrafts.deletedAt),
      ),
    )

  return {
    emailPending,
    linkedInPending,
    sentThisWeek: sentStats?.count ?? 0,
  }
}

export async function getMessageDrafterPayload(accountId: string): Promise<MessageDrafterPayload> {
  const [emailDrafts, linkedInDrafts] = await Promise.all([
    findPendingEmailDrafts(accountId),
    findPendingLinkedInDrafts(accountId),
  ])

  const stats = await getMessageDrafterStats(
    accountId,
    emailDrafts.length,
    linkedInDrafts.length,
  )

  return { emailDrafts, linkedInDrafts, stats }
}
