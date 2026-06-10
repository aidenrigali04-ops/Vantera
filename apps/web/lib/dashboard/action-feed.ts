import { db } from '@/lib/db/client'
import { activities, contacts, intelligenceSignals, leads, records } from '@vantera/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

export type ActionFeedItem = {
  id: string
  type:
    | 'stalled_deal'
    | 'overdue_task'
    | 'churn_risk'
    | 'reply_detected'
    | 'lead_activity'
    | 'aspire_icp_match'
    | 'draft_ready'
    | 'score_increased'
    | 'email_clicked'
    | 'email_bounced'
    | 'high_icp_no_outreach'
    | 'linkedin_step_ready'
  title: string
  subtitle: string
  href: string
  createdAt: Date
  severity?: 'red' | 'yellow' | 'green'
  draftId?: string
  campaignId?: string
}

export async function getOperationalActionFeed(accountId: string, limit = 8): Promise<ActionFeedItem[]> {
  const items: ActionFeedItem[] = []

  const atRiskContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.lifecycleStage, 'active_client'),
        isNull(contacts.deletedAt),
        sql`${contacts.churnRiskScore} > 70`,
      ),
    )
    .limit(5)

  for (const contact of atRiskContacts) {
    items.push({
      id: `churn-${contact.id}`,
      type: 'churn_risk',
      title: `${contact.firstName} ${contact.lastName} at churn risk`,
      subtitle: `Risk score ${contact.churnRiskScore}`,
      href: `/admin/clients/${contact.id}`,
      createdAt: contact.updatedAt,
    })
  }

  const overdueRecords = await db
    .select({ record: records, contact: contacts })
    .from(records)
    .innerJoin(contacts, eq(records.contactId, contacts.id))
    .where(
      and(
        eq(records.accountId, accountId),
        isNull(records.deletedAt),
        isNull(records.completedAt),
        sql`${records.scheduledAt} < now()`,
      ),
    )
    .limit(5)

  for (const row of overdueRecords) {
    items.push({
      id: `overdue-${row.record.id}`,
      type: 'overdue_task',
      title: `Overdue: ${row.record.title}`,
      subtitle: `${row.contact.firstName} ${row.contact.lastName}`,
      href: `/admin/records/${row.record.id}`,
      createdAt: row.record.scheduledAt ?? row.record.updatedAt,
    })
  }

  const recentReplies = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.accountId, accountId),
        sql`${activities.activityType} in ('linkedin_dm', 'email_reply', 'reply_detected')`,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(5)

  for (const activity of recentReplies) {
    const metadata = activity.metadata as { campaignId?: string } | null
    items.push({
      id: `reply-${activity.id}`,
      type: 'reply_detected',
      title: activity.body ?? 'New reply detected',
      subtitle: activity.activityType.replace(/_/g, ' '),
      href: metadata?.campaignId
        ? `/admin/outreach/campaigns/${metadata.campaignId}`
        : activity.leadId
          ? `/admin/crm/pipeline/${activity.leadId}`
          : activity.contactId
            ? `/admin/clients/${activity.contactId}`
            : '/admin/crm/pipeline',
      createdAt: activity.createdAt,
    })
  }

  const stalledLeads = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.accountId, accountId),
        isNull(leads.deletedAt),
        isNull(leads.convertedContactId),
        sql`${leads.updatedAt} < now() - interval '7 days'`,
        sql`${leads.relationshipStatus} not in ('won', 'lost')`,
      ),
    )
    .limit(5)

  for (const lead of stalledLeads) {
    items.push({
      id: `stalled-${lead.id}`,
      type: 'stalled_deal',
      title: `Stalled prospect: ${lead.company}`,
      subtitle: `No activity in 7+ days · ${lead.relationshipStatus}`,
      href: `/admin/crm/pipeline/${lead.id}`,
      createdAt: lead.updatedAt,
    })
  }

  const signals = await db
    .select()
    .from(intelligenceSignals)
    .where(
      and(
        eq(intelligenceSignals.accountId, accountId),
        eq(intelligenceSignals.isDismissed, false),
        sql`(${intelligenceSignals.expiresAt} IS NULL OR ${intelligenceSignals.expiresAt} > now())`,
      ),
    )
    .orderBy(desc(intelligenceSignals.createdAt))
    .limit(10)

  for (const signal of signals) {
    const payload = signal.actionPayload as Record<string, unknown>
    const rawSignalType = signal.signalType

    let href = '/admin/dashboard'
    let draftId: string | undefined
    let campaignId: string | undefined

    if (typeof payload.href === 'string' && payload.href.startsWith('/')) {
      href = payload.href
    } else if (rawSignalType === 'draft_ready' && payload.draftId) {
      draftId = String(payload.draftId)
      href = `/admin/outreach/agents/drafter?tab=email&draft=${draftId}`
    } else if (rawSignalType === 'linkedin_step_ready' && payload.stepId) {
      href = `/admin/outreach/agents/drafter?tab=linkedin&step=${payload.stepId}&source=campaign`
    } else if (
      rawSignalType === 'aspire_icp_match' &&
      payload.source === 'prospect_scout'
    ) {
      href = '/admin/crm/pipeline'
    } else if (rawSignalType === 'aspire_icp_match' && payload.searchId) {
      href = `/admin/outreach/agents/scout/runs/${payload.searchId}`
    } else if (payload.campaignId) {
      campaignId = String(payload.campaignId)
      href = `/admin/outreach/campaigns/${payload.campaignId}`
    } else if (payload.leadId) {
      href = `/admin/crm/pipeline/${payload.leadId}`
    } else if (payload.contactId) {
      href = `/admin/clients/${payload.contactId}`
    }

    if (payload.draftId) {
      draftId = String(payload.draftId)
    }

    let mappedType: ActionFeedItem['type'] = 'lead_activity'
    if (
      rawSignalType === 'aspire_icp_match' ||
      rawSignalType === 'draft_ready' ||
      rawSignalType === 'score_increased' ||
      rawSignalType === 'email_clicked' ||
      rawSignalType === 'email_bounced' ||
      rawSignalType === 'high_icp_no_outreach' ||
      rawSignalType === 'linkedin_step_ready'
    ) {
      mappedType = rawSignalType
    } else if (rawSignalType === 'draft_pending' || rawSignalType === 'draft_sent') {
      mappedType = 'draft_ready'
      if (payload.draftId) {
        draftId = String(payload.draftId)
        href = `/admin/outreach/agents/drafter?tab=email&draft=${draftId}`
      }
    }

    items.push({
      id: `signal-${signal.id}`,
      type: mappedType,
      title: signal.headline,
      subtitle: signal.recommendation ?? signal.actionLabel ?? signal.signalType,
      href,
      createdAt: signal.createdAt,
      severity: signal.severity,
      draftId,
      campaignId,
    })
  }

  const severityRank = { red: 0, yellow: 1, green: 2 }

  return items
    .sort((a, b) => {
      const aRank = a.severity ? severityRank[a.severity] : 3
      const bRank = b.severity ? severityRank[b.severity] : 3
      if (aRank !== bRank) return aRank - bRank
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, limit)
}
