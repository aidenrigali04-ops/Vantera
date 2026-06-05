import { db } from '@/lib/db/client'
import type { ExtensionLinkedInQueueItem, ExtensionLinkedInQueueSnapshot } from '@/lib/extension/linkedin/types'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { resolveOutboundCopy } from '@/lib/outreach/types'
import {
  leads,
  outreachCampaignSteps,
  outreachCampaigns,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'

function leadDisplayName(lead: {
  firstName: string | null
  lastName: string | null
  company: string | null
}): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Unknown lead'
}

function normalizeLinkedInUrl(url: string | null): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (trimmed.startsWith('http')) return trimmed
  return `https://${trimmed}`
}

export async function findExtensionLinkedInQueue(
  accountId: string,
  options?: { limit?: number; dailyLimit?: number; dailySent?: number },
): Promise<ExtensionLinkedInQueueSnapshot> {
  const limit = options?.limit ?? 25
  const dailyLimit = options?.dailyLimit ?? 50
  const dailySent = options?.dailySent ?? 0
  const now = new Date()
  const automatic = await isAccountAutomaticOutreach(accountId)
  const outreachMode = automatic ? 'automatic' : 'manual'

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
        lte(outreachCampaignSteps.sendAt, now),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
        isNull(outreachCampaigns.deletedAt),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(asc(outreachCampaignSteps.sendAt))
    .limit(limit)

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
        lte(sdrSequenceSteps.scheduledFor, now),
        isNull(sdrSequenceSteps.deletedAt),
        isNull(leads.deletedAt),
        eq(sdrSequences.status, 'active'),
      ),
    )
    .orderBy(asc(sdrSequenceSteps.scheduledFor))
    .limit(limit)

  const campaignItems: ExtensionLinkedInQueueItem[] = []
  for (const { step, lead, campaign } of campaignRows) {
    const linkedinUrl = normalizeLinkedInUrl(lead.linkedinUrl)
    if (!linkedinUrl) continue

    const metadata = step.metadata as { message?: string } | null
    const message =
      metadata?.message ??
      resolveOutboundCopy(step.body, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        email: lead.email,
        title: lead.title,
      })

    campaignItems.push({
      id: step.id,
      source: 'campaign',
      outreachMode,
      leadId: lead.id,
      leadName: leadDisplayName(lead),
      company: lead.company,
      linkedinUrl,
      message,
      scheduledAt: step.sendAt.toISOString(),
      campaignName: campaign.name,
      campaignId: campaign.id,
      stepIndex: step.stepIndex,
    })
  }

  const sdrItems: ExtensionLinkedInQueueItem[] = []
  for (const { step, lead } of sdrRows) {
    const linkedinUrl = normalizeLinkedInUrl(lead.linkedinUrl)
    if (!linkedinUrl) continue

    sdrItems.push({
      id: step.id,
      source: 'sdr_sequence',
      outreachMode,
      leadId: lead.id,
      leadName: leadDisplayName(lead),
      company: lead.company,
      linkedinUrl,
      message: step.body,
      scheduledAt: step.scheduledFor.toISOString(),
      campaignName: 'SDR sequence',
      campaignId: null,
      stepIndex: step.stepNumber - 1,
    })
  }

  const items = [...campaignItems, ...sdrItems]
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, limit)

  return {
    updatedAt: now.toISOString(),
    outreachMode,
    pacing: {
      dailyLimit,
      dailySent,
      canSend: dailySent < dailyLimit,
    },
    items,
  }
}
