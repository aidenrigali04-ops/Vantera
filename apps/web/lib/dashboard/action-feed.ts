import { db } from '@/lib/db/client'
import { activities, contacts, leads, records } from '@vantera/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

export type ActionFeedItem = {
  id: string
  type: 'stalled_deal' | 'overdue_task' | 'churn_risk' | 'reply_detected' | 'lead_activity'
  title: string
  subtitle: string
  href: string
  createdAt: Date
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
      href: `/admin/crm/clients/${contact.id}`,
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
    items.push({
      id: `reply-${activity.id}`,
      type: 'reply_detected',
      title: activity.body ?? 'New reply detected',
      subtitle: activity.activityType.replace(/_/g, ' '),
      href: activity.leadId
        ? `/admin/crm/pipeline/${activity.leadId}`
        : activity.contactId
          ? `/admin/crm/clients/${activity.contactId}`
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

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
