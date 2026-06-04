import { db } from '@/lib/db/client'
import { getAccount } from '@/lib/db/queries'
import type {
  AdminPortalMeta,
  PortalActivity,
  PortalApproval,
  PortalBillingSummary,
  PortalDeliverable,
  PortalDocument,
  PortalInvoice,
  PortalMessage,
  PortalProject,
  PortalWorkspace,
} from '@/lib/portal/types'
import { loadPortalConfig } from '@/lib/portal/load-portal-config'
import type { PortalNavCounts } from '@/lib/portal/types'
import { derivePortalLoginUrl, derivePortalUrl } from '@/lib/portal/url'
import { activities, contacts, documents, invoices, messages, records, stageDefinitions } from '@vantera/db'
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'

function projectProgress(
  stagePosition: number,
  maxPosition: number,
  isTerminalWin: boolean,
): number {
  if (isTerminalWin) return 100
  if (maxPosition <= 0) return 0
  return Math.min(100, Math.round((stagePosition / maxPosition) * 100))
}

function deriveBillingFromInvoices(invoiceRows: PortalInvoice[]): PortalBillingSummary {
  const openStatuses = ['sent', 'viewed', 'overdue'] as const
  const open = invoiceRows.filter((inv) =>
    openStatuses.includes(inv.status as (typeof openStatuses)[number]),
  )

  const outstandingCents = open.reduce(
    (sum, inv) => sum + Math.max(0, inv.amountCents - inv.paidCents),
    0,
  )

  const overdue = open.some((inv) => inv.status === 'overdue')
  const dueSoon = open.some((inv) => {
    if (!inv.dueAt) return false
    const days = (inv.dueAt.getTime() - Date.now()) / 86400000
    return days >= 0 && days <= 14
  })

  const nextDue = open
    .map((inv) => inv.dueAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())[0]

  let status: PortalBillingSummary['status'] = 'current'
  if (overdue) status = 'overdue'
  else if (dueSoon || outstandingCents > 0) status = 'due_soon'

  return {
    outstandingCents,
    nextDueDate: nextDue ?? null,
    status,
  }
}

function mapDocumentToDeliverable(doc: PortalDocument): PortalDeliverable {
  let status: PortalDeliverable['status'] = 'delivered'
  if (doc.requiresSignature && !doc.signedAt) {
    status = 'in_review'
  } else if (doc.requiresSignature && doc.signedAt) {
    status = 'approved'
  }

  return {
    id: doc.id,
    title: doc.title,
    status,
    dueAt: null,
    storageUrl: doc.storageUrl,
  }
}

function mapDocumentToApproval(doc: PortalDocument): PortalApproval | null {
  if (!doc.requiresSignature || doc.signedAt) return null

  return {
    id: doc.id,
    title: doc.title,
    status: 'pending',
    requestedAt: doc.createdAt,
    storageUrl: doc.storageUrl,
  }
}

async function loadProjects(accountId: string, contactId: string): Promise<PortalProject[]> {
  const stages = await db
    .select()
    .from(stageDefinitions)
    .where(
      and(eq(stageDefinitions.accountId, accountId), eq(stageDefinitions.recordType, 'project')),
    )

  const maxPosition = stages.reduce((max, s) => Math.max(max, s.position), 1)
  const stageById = new Map(stages.map((s) => [s.id, s]))

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        eq(records.contactId, contactId),
        eq(records.recordType, 'project'),
        isNull(records.deletedAt),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(12)

  return rows.map((row) => {
    const stage = stageById.get(row.stageId)
    return {
      id: row.id,
      title: row.title,
      stageLabel: stage?.label ?? 'Active',
      stageColor: stage?.color ?? '#60A5FA',
      progress: projectProgress(stage?.position ?? 1, maxPosition, stage?.isTerminalWin ?? false),
      valueCents: row.valueCents,
      updatedAt: row.updatedAt,
    }
  })
}

async function loadClientActivities(
  accountId: string,
  contactId: string,
): Promise<PortalActivity[]> {
  const rows = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.accountId, accountId),
        eq(activities.contactId, contactId),
        eq(activities.visibleToClient, true),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(20)

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    activityType: row.activityType,
    createdAt: row.createdAt,
  }))
}

async function loadPortalInvoices(
  accountId: string,
  contactId: string,
): Promise<PortalInvoice[]> {
  const rows = await db
    .select({
      id: invoices.id,
      amountCents: invoices.amountCents,
      paidCents: invoices.paidCents,
      status: invoices.status,
      dueAt: invoices.dueAt,
      paidAt: invoices.paidAt,
      paymentLinkUrl: invoices.paymentLinkUrl,
      createdAt: invoices.createdAt,
      recordTitle: records.title,
    })
    .from(invoices)
    .leftJoin(records, eq(invoices.recordId, records.id))
    .where(
      and(
        eq(invoices.accountId, accountId),
        eq(invoices.contactId, contactId),
        isNull(invoices.deletedAt),
        inArray(invoices.status, ['sent', 'viewed', 'paid', 'overdue']),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(20)

  return rows.map((row) => ({
    id: row.id,
    recordTitle: row.recordTitle,
    amountCents: row.amountCents,
    paidCents: row.paidCents,
    status: row.status,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    paymentLinkUrl: row.paymentLinkUrl,
    createdAt: row.createdAt,
  }))
}

async function loadPortalDocuments(
  accountId: string,
  contactId: string,
): Promise<PortalDocument[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.accountId, accountId),
        eq(documents.visibleToClient, true),
        isNull(documents.deletedAt),
        or(eq(documents.contactId, contactId), eq(documents.signerContactId, contactId)),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(24)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    docType: row.docType,
    storageUrl: row.storageUrl,
    requiresSignature: row.requiresSignature,
    signedAt: row.signedAt,
    createdAt: row.createdAt,
  }))
}

async function loadPortalMessages(
  accountId: string,
  contactId: string,
): Promise<PortalMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.accountId, accountId),
        eq(messages.contactId, contactId),
        eq(messages.channel, 'portal'),
        isNull(messages.deletedAt),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50)

  return rows
    .map((row) => ({
      id: row.id,
      direction: row.direction,
      body: row.body,
      subject: row.subject,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      readAt: row.readAt,
    }))
    .reverse()
}

export async function getPortalWorkspace(
  accountId: string,
  contactId: string,
): Promise<PortalWorkspace | null> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.accountId, accountId), eq(contacts.id, contactId), isNull(contacts.deletedAt)),
    )
    .limit(1)

  if (!contact) return null

  const config = await loadPortalConfig(accountId)

  const [projects, activityList, invoiceRows, documentRows, messageRows] = await Promise.all([
    loadProjects(accountId, contactId),
    loadClientActivities(accountId, contactId),
    loadPortalInvoices(accountId, contactId),
    loadPortalDocuments(accountId, contactId),
    loadPortalMessages(accountId, contactId),
  ])

  const deliverables = documentRows.map(mapDocumentToDeliverable)
  const approvals = documentRows
    .map(mapDocumentToApproval)
    .filter((item): item is PortalApproval => item != null)
  const billing = deriveBillingFromInvoices(invoiceRows)
  const unreadMessageCount = messageRows.filter(
    (m) => m.direction === 'outbound' && !m.readAt,
  ).length

  return {
    contactFirstName: contact.firstName,
    contactLastName: contact.lastName,
    config,
    projects,
    activities: activityList,
    deliverables,
    approvals,
    billing,
    invoices: invoiceRows,
    documents: documentRows,
    messages: messageRows,
    unreadMessageCount,
  }
}

export async function getPortalNavCounts(
  accountId: string,
  contactId: string,
): Promise<PortalNavCounts> {
  const workspace = await getPortalWorkspace(accountId, contactId)
  if (!workspace) {
    return {
      projects: 0,
      messages: 0,
      unreadMessages: 0,
      openInvoices: 0,
      pendingApprovals: 0,
      documents: 0,
      activities: 0,
    }
  }

  const openInvoices = workspace.invoices.filter((inv) =>
    ['sent', 'viewed', 'overdue'].includes(inv.status),
  ).length

  return {
    projects: workspace.projects.length,
    messages: workspace.messages.length,
    unreadMessages: workspace.unreadMessageCount,
    openInvoices,
    pendingApprovals: workspace.approvals.length,
    documents: workspace.documents.length,
    activities: workspace.activities.length,
  }
}

export async function findPreviewContactId(accountId: string): Promise<string | null> {
  const [withPortal] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.portalAccess, true),
        isNull(contacts.deletedAt),
      ),
    )
    .orderBy(desc(contacts.updatedAt))
    .limit(1)

  if (withPortal?.id) return withPortal.id

  const [withProject] = await db
    .select({ contactId: records.contactId })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        eq(records.recordType, 'project'),
        isNull(records.deletedAt),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1)

  if (withProject?.contactId) return withProject.contactId

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), isNull(contacts.deletedAt)))
    .orderBy(desc(contacts.updatedAt))
    .limit(1)

  return contact?.id ?? null
}

export async function getAdminPortalMeta(accountId: string): Promise<AdminPortalMeta> {
  const account = await getAccount(accountId)
  const portalOpts = account
    ? { portalDomainStatus: account.portalDomainStatus }
    : undefined
  const portalUrl = account
    ? derivePortalUrl(account.slug, account.portalDomain, portalOpts)
    : derivePortalUrl('workspace', null)
  const portalLoginUrl = account
    ? derivePortalLoginUrl(account.slug, account.portalDomain, portalOpts)
    : derivePortalLoginUrl('workspace', null)

  const [enabledRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.portalAccess, true),
        isNull(contacts.deletedAt),
      ),
    )

  const previewContactId = await findPreviewContactId(accountId)
  let previewContactName: string | null = null

  if (previewContactId) {
    const [contact] = await db
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, previewContactId))
      .limit(1)
    if (contact) {
      previewContactName = `${contact.firstName} ${contact.lastName}`.trim()
    }
  }

  return {
    portalUrl,
    portalLoginUrl,
    portalEnabledCount: enabledRow?.count ?? 0,
    previewContactName,
  }
}
