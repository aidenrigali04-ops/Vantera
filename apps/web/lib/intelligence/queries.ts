import { db } from '@/lib/db/client'
import type { EmbeddedInsight, InsightSeverity } from '@/lib/intelligence/types'
import { activities, contacts, intelligenceSignals, leads, records } from '@vantera/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

function signalHref(row: {
  contactId: string | null
  recordId: string | null
  signalType: string
}): string {
  if (row.contactId) return `/admin/clients/${row.contactId}`
  if (row.recordId) return `/admin/records/${row.recordId}`
  if (row.signalType.includes('lead') || row.signalType.includes('prospect')) {
    return '/admin/crm/pipeline'
  }
  return '/admin/dashboard'
}

function mapSignal(row: {
  id: string
  signalType: string
  severity: InsightSeverity
  headline: string
  recommendation: string | null
  actionLabel: string | null
  contactId: string | null
  recordId: string | null
}): EmbeddedInsight {
  return {
    id: row.id,
    headline: row.headline,
    recommendation: row.recommendation ?? '',
    severity: row.severity,
    actionLabel: row.actionLabel,
    actionHref: signalHref(row),
    dismissible: true,
    source: 'signal',
  }
}

async function loadActiveSignals(
  accountId: string,
  filters?: { contactId?: string; recordId?: string },
  limit = 5,
): Promise<EmbeddedInsight[]> {
  const conditions = [
    eq(intelligenceSignals.accountId, accountId),
    eq(intelligenceSignals.isDismissed, false),
  ]

  if (filters?.contactId) {
    conditions.push(eq(intelligenceSignals.contactId, filters.contactId))
  }
  if (filters?.recordId) {
    conditions.push(eq(intelligenceSignals.recordId, filters.recordId))
  }

  const rows = await db
    .select()
    .from(intelligenceSignals)
    .where(and(...conditions))
    .orderBy(desc(intelligenceSignals.createdAt))
    .limit(limit)

  return rows.map(mapSignal)
}

async function deriveAccountInsights(accountId: string, limit: number): Promise<EmbeddedInsight[]> {
  const insights: EmbeddedInsight[] = []

  const [atRisk, stalledLeads, overdueCount, upsellContacts] = await Promise.all([
    db
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
      .orderBy(desc(contacts.churnRiskScore))
      .limit(2),
    db
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
      .orderBy(desc(leads.updatedAt))
      .limit(2),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(records)
      .where(
        and(
          eq(records.accountId, accountId),
          isNull(records.deletedAt),
          isNull(records.completedAt),
          sql`${records.scheduledAt} < now()`,
        ),
      ),
    db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.accountId, accountId),
          isNull(contacts.deletedAt),
          sql`${contacts.upsellScore} >= 75`,
        ),
      )
      .orderBy(desc(contacts.upsellScore))
      .limit(1),
  ])

  for (const contact of atRisk) {
    insights.push({
      id: `derived-churn-${contact.id}`,
      headline: `${contact.firstName} ${contact.lastName} may churn soon`,
      recommendation: `Churn risk is ${contact.churnRiskScore}. Schedule a check-in and review open delivery work.`,
      severity: 'red',
      actionLabel: 'View client',
      actionHref: `/admin/clients/${contact.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  for (const lead of stalledLeads) {
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company
    insights.push({
      id: `derived-stalled-${lead.id}`,
      headline: `${name || lead.company} has low momentum`,
      recommendation: `No activity in 7+ days while status is ${lead.relationshipStatus.replace(/_/g, ' ')}. Re-engage or move stage.`,
      severity: 'yellow',
      actionLabel: 'Open prospect',
      actionHref: `/admin/crm/pipeline/${lead.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  const overdue = overdueCount[0]?.count ?? 0
  if (overdue >= 2) {
    insights.push({
      id: `derived-overdue-${accountId}`,
      headline: 'Task overload detected on your team',
      recommendation: `${overdue} scheduled items are overdue across active clients. Reassign or reschedule to protect delivery.`,
      severity: 'red',
      actionLabel: 'Review pipeline',
      actionHref: '/admin/crm/pipeline',
      dismissible: true,
      source: 'derived',
    })
  }

  const upsell = upsellContacts[0]
  if (upsell) {
    insights.push({
      id: `derived-upsell-${upsell.id}`,
      headline: 'Upsell opportunity identified',
      recommendation: `${upsell.firstName} ${upsell.lastName} has strong expansion signals (score ${upsell.upsellScore}). Propose the next engagement.`,
      severity: 'green',
      actionLabel: 'View client',
      actionHref: `/admin/clients/${upsell.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  return insights.slice(0, limit)
}

export async function findAccountEmbeddedInsights(
  accountId: string,
  limit = 4,
): Promise<EmbeddedInsight[]> {
  const signals = await loadActiveSignals(accountId, undefined, limit)
  if (signals.length >= limit) return signals

  const derived = await deriveAccountInsights(accountId, limit - signals.length)
  const seen = new Set(signals.map((s) => s.headline))
  const merged = [...signals]

  for (const item of derived) {
    if (merged.length >= limit) break
    if (seen.has(item.headline)) continue
    merged.push(item)
  }

  return merged
}

export async function findContactEmbeddedInsights(
  accountId: string,
  contactId: string,
  limit = 3,
): Promise<EmbeddedInsight[]> {
  const signals = await loadActiveSignals(accountId, { contactId }, limit)
  if (signals.length >= limit) return signals

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), eq(contacts.id, contactId)))
    .limit(1)

  if (!contact) return signals

  const derived: EmbeddedInsight[] = []

  if (contact.churnRiskScore > 70) {
    derived.push({
      id: `derived-churn-${contact.id}`,
      headline: 'Client may churn soon',
      recommendation: `Risk score ${contact.churnRiskScore}. Confirm delivery status and schedule a retention conversation.`,
      severity: 'red',
      actionLabel: 'Log check-in',
      actionHref: `/admin/clients/${contact.id}`,
      dismissible: true,
      source: 'derived',
    })
  } else if (contact.churnRiskScore >= 40) {
    derived.push({
      id: `derived-watch-${contact.id}`,
      headline: 'Relationship needs attention',
      recommendation: 'Health is in watch territory. Share a progress update before the next renewal window.',
      severity: 'yellow',
      actionLabel: 'View activity',
      actionHref: `/admin/clients/${contact.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  if (contact.upsellScore >= 75) {
    derived.push({
      id: `derived-upsell-${contact.id}`,
      headline: 'Upsell opportunity identified',
      recommendation: `Expansion score ${contact.upsellScore}. Package the next phase while delivery momentum is high.`,
      severity: 'green',
      actionLabel: 'Create deal',
      actionHref: '/admin/crm/pipeline',
      dismissible: true,
      source: 'derived',
    })
  }

  if (!contact.portalLastLoginAt) {
    derived.push({
      id: `derived-portal-${contact.id}`,
      headline: 'Client has not opened the portal',
      recommendation: 'Invite them to the client portal so approvals and deliverables stay transparent.',
      severity: 'yellow',
      actionLabel: 'Portal settings',
      actionHref: '/admin/portal',
      dismissible: true,
      source: 'derived',
    })
  }

  return [...signals, ...derived].slice(0, limit)
}

export async function findLeadEmbeddedInsights(
  accountId: string,
  leadId: string,
  limit = 3,
): Promise<EmbeddedInsight[]> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) return []

  const derived: EmbeddedInsight[] = []
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company
  const daysIdle = Math.floor(
    (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysIdle >= 7 && !['won', 'lost'].includes(lead.relationshipStatus)) {
    derived.push({
      id: `derived-stalled-${lead.id}`,
      headline: 'This deal has low momentum',
      recommendation: `No updates in ${daysIdle} days. Send a follow-up or advance the stage to keep the pipeline moving.`,
      severity: 'yellow',
      actionLabel: 'Update status',
      actionHref: `/admin/crm/pipeline/${lead.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  if ((lead.score ?? 0) >= 80 && ['new', 'contacted', 'nurturing'].includes(lead.relationshipStatus)) {
    derived.push({
      id: `derived-qualified-${lead.id}`,
      headline: 'High-intent prospect ready to advance',
      recommendation: `Score ${lead.score} with status ${lead.relationshipStatus.replace(/_/g, ' ')}. Move to qualified or book discovery.`,
      severity: 'green',
      actionLabel: 'Mark qualified',
      actionHref: `/admin/crm/pipeline/${lead.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  if (!lead.email && !lead.linkedinUrl) {
    derived.push({
      id: `derived-enrich-${lead.id}`,
      headline: 'Missing contact channels',
      recommendation: `${name} has no email or LinkedIn on file. Enrich via Aspire before enrolling outreach.`,
      severity: 'yellow',
      actionLabel: 'Find in Aspire',
      actionHref: '/admin/outreach/aspire',
      dismissible: true,
      source: 'derived',
    })
  }

  const recentReply = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.accountId, accountId),
        eq(activities.leadId, leadId),
        sql`${activities.activityType} in ('linkedin_dm', 'email_reply', 'reply_detected')`,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(1)

  if (recentReply[0]) {
    derived.push({
      id: `derived-reply-${lead.id}`,
      headline: 'Reply detected — act while interest is warm',
      recommendation: recentReply[0].body ?? 'Prospect responded recently. Prioritize a human follow-up today.',
      severity: 'green',
      actionLabel: 'View timeline',
      actionHref: `/admin/crm/pipeline/${lead.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  return derived.slice(0, limit)
}

export async function findRecordEmbeddedInsights(
  accountId: string,
  recordId: string,
  limit = 3,
): Promise<EmbeddedInsight[]> {
  const signals = await loadActiveSignals(accountId, { recordId }, limit)
  if (signals.length >= limit) return signals

  const [record] = await db
    .select()
    .from(records)
    .where(
      and(eq(records.accountId, accountId), eq(records.id, recordId), isNull(records.deletedAt)),
    )
    .limit(1)

  if (!record) return signals

  const derived: EmbeddedInsight[] = []
  const daysIdle = Math.floor(
    (Date.now() - new Date(record.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (
    record.scheduledAt &&
    !record.completedAt &&
    new Date(record.scheduledAt).getTime() < Date.now()
  ) {
    derived.push({
      id: `derived-overdue-${record.id}`,
      headline: 'Delivery item is overdue',
      recommendation: 'Scheduled date has passed without completion. Reschedule or reassign to protect client trust.',
      severity: 'red',
      actionLabel: 'Update schedule',
      actionHref: `/admin/records/${record.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  if (daysIdle >= 14 && !record.completedAt) {
    derived.push({
      id: `derived-stalled-${record.id}`,
      headline: 'Project momentum is slowing',
      recommendation: `No updates in ${daysIdle} days. Add a note or advance the stage to keep delivery visible.`,
      severity: 'yellow',
      actionLabel: 'Review project',
      actionHref: `/admin/records/${record.id}`,
      dismissible: true,
      source: 'derived',
    })
  }

  if (record.priority === 'urgent' && !record.completedAt) {
    derived.push({
      id: `derived-urgent-${record.id}`,
      headline: 'Urgent priority needs attention',
      recommendation: 'This project is flagged urgent. Confirm owner capacity and next milestone today.',
      severity: 'red',
      actionLabel: 'View workload',
      actionHref: '/admin/records',
      dismissible: true,
      source: 'derived',
    })
  }

  return [...signals, ...derived].slice(0, limit)
}
