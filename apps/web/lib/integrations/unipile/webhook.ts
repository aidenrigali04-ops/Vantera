import { db } from '@/lib/db/client'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import { activities, leads, linkedinAccounts, outreachCampaignSteps, sdrSequenceSteps } from '@vantera/db'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { UnipileAccountConnectedEvent, UnipileNewMessageEvent, UnipileWebhookEvent } from './types'

/** Route an inbound Unipile webhook event to the correct handler. */
export async function handleUnipileWebhook(event: UnipileWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'account_connected':
      await handleAccountConnected(event as UnipileAccountConnectedEvent)
      break
    case 'account_disconnected':
      await handleAccountDisconnected(event)
      break
    case 'new_message':
      await handleNewMessage(event as UnipileNewMessageEvent)
      break
    case 'invitation_accepted':
      await handleInvitationAccepted(event)
      break
    default:
      break
  }
}

async function handleAccountConnected(event: UnipileAccountConnectedEvent): Promise<void> {
  const unipileAccountId = event.account_id ?? event.data?.account_id
  if (!unipileAccountId) return

  await db
    .update(linkedinAccounts)
    .set({
      unipileConnected: true,
      unipileConnectedAt: new Date(),
      unipileLastError: null,
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.unipileAccountId, String(unipileAccountId)))
}

async function handleAccountDisconnected(event: UnipileWebhookEvent): Promise<void> {
  const unipileAccountId = event.account_id
  if (!unipileAccountId) return

  await db
    .update(linkedinAccounts)
    .set({
      unipileConnected: false,
      unipileLastError: 'disconnected',
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.unipileAccountId, unipileAccountId))
}

async function handleNewMessage(event: UnipileNewMessageEvent): Promise<void> {
  const { account_id, data } = event
  if (!account_id || data.is_outbound) return

  const senderName = data.sender_name ?? 'Unknown'
  const text = data.text ?? ''

  // Map the Unipile account back to a Vantera account
  const [liAccount] = await db
    .select({ accountId: linkedinAccounts.accountId })
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.unipileAccountId, account_id))
    .limit(1)

  if (!liAccount) return

  const accountId = liAccount.accountId

  // Try to find the lead by matching the sender's chat against known linkedin URLs
  const matchedLead = await findLeadBySenderId(accountId, data.sender_id)

  if (matchedLead) {
    await db.insert(activities).values({
      accountId,
      leadId: matchedLead.id,
      actorType: 'contact',
      actorId: matchedLead.id,
      activityType: 'linkedin_reply',
      body: text.slice(0, 500),
      metadata: {
        unipileMessageId: data.id,
        chatId: data.chat_id,
        senderName,
        source: 'unipile',
      },
    })

    await createIntelligenceSignal({
      accountId,
      signalType: 'linkedin_reply',
      severity: 'green',
      headline: `LinkedIn reply from ${senderName}`,
      recommendation: 'Review and respond to move the lead forward.',
      actionLabel: 'View lead',
      actionPayload: { leadId: matchedLead.id },
      expiresInDays: 14,
    })

    // Advance relationship status on positive reply
    if (matchedLead.relationshipStatus === 'contacted' || matchedLead.relationshipStatus === 'connected') {
      await db
        .update(leads)
        .set({ relationshipStatus: 'nurturing', updatedAt: new Date() })
        .where(eq(leads.id, matchedLead.id))
    }
  }
}

async function handleInvitationAccepted(event: UnipileWebhookEvent): Promise<void> {
  const { account_id, data } = event
  if (!account_id) return

  const [liAccount] = await db
    .select({ accountId: linkedinAccounts.accountId })
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.unipileAccountId, account_id))
    .limit(1)

  if (!liAccount) return

  const accountId = liAccount.accountId
  const senderName = (data?.name as string) ?? 'Unknown'
  const linkedinUrl = (data?.linkedin_url as string) ?? null

  const matchedLead = linkedinUrl
    ? await findLeadByLinkedInUrl(accountId, linkedinUrl)
    : null

  if (matchedLead) {
    await db.insert(activities).values({
      accountId,
      leadId: matchedLead.id,
      actorType: 'contact',
      actorId: matchedLead.id,
      activityType: 'linkedin_connected',
      body: `${senderName} accepted your connection request on LinkedIn`,
      metadata: { source: 'unipile' },
    })

    if (matchedLead.relationshipStatus === 'contacted' || matchedLead.relationshipStatus === 'new') {
      await db
        .update(leads)
        .set({ relationshipStatus: 'connected', updatedAt: new Date() })
        .where(eq(leads.id, matchedLead.id))
    }
  }
}

async function findLeadBySenderId(accountId: string, senderId: string) {
  // Unipile sender_id is the LinkedIn member URN or ID — try matching against stored URLs
  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.accountId, accountId),
        isNotNull(leads.linkedinUrl),
      ),
    )
    .limit(200)

  // senderId may appear as part of the linkedin URL (e.g. in:someId)
  const normalized = senderId.replace(/^.*:/, '').toLowerCase()
  return rows.find((l) => l.linkedinUrl?.toLowerCase().includes(normalized)) ?? null
}

async function findLeadByLinkedInUrl(accountId: string, linkedinUrl: string) {
  const normalized = linkedinUrl.replace(/\/$/, '').toLowerCase()
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.accountId, accountId), isNotNull(leads.linkedinUrl)))
    .limit(500)

  return rows.find((l) => l?.linkedinUrl?.replace(/\/$/, '').toLowerCase() === normalized) ?? null
}
