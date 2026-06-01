import { db } from '@/lib/db/client'
import { getAccount } from '@/lib/db/queries'
import type {
  AdminPortalMeta,
  PortalActivity,
  PortalApproval,
  PortalBillingSummary,
  PortalDeliverable,
  PortalProject,
  PortalWorkspace,
} from '@/lib/portal/types'
import { derivePortalUrl } from '@/lib/portal/url'
import { activities, contacts, records, stageDefinitions } from '@vantera/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

function projectProgress(
  stagePosition: number,
  maxPosition: number,
  isTerminalWin: boolean,
): number {
  if (isTerminalWin) return 100
  if (maxPosition <= 0) return 0
  return Math.min(100, Math.round((stagePosition / maxPosition) * 100))
}

function deriveDeliverables(projects: PortalProject[]): PortalDeliverable[] {
  return projects.slice(0, 4).map((project, index) => ({
    id: `del-${project.id}`,
    title: index === 0 ? `${project.title} — milestone review` : `${project.title} — deliverable pack`,
    status: index === 0 ? 'in_review' : index === 1 ? 'pending' : 'delivered',
    dueAt: index === 0 ? new Date(Date.now() + 3 * 86400000) : null,
  }))
}

function deriveApprovals(activitiesList: PortalActivity[]): PortalApproval[] {
  const fromActivities = activitiesList
    .filter((a) => a.activityType.includes('approval') || a.body?.toLowerCase().includes('approval'))
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      title: a.body ?? 'Approval requested',
      status: 'pending' as const,
      requestedAt: a.createdAt,
    }))

  if (fromActivities.length > 0) return fromActivities

  return [
    {
      id: 'approval-demo-1',
      title: 'Q2 campaign creative — review and approve',
      status: 'pending',
      requestedAt: new Date(Date.now() - 2 * 86400000),
    },
  ]
}

function deriveBilling(projects: PortalProject[]): PortalBillingSummary {
  const outstandingCents = projects.reduce((sum, p) => sum + Math.round(p.valueCents * 0.25), 0)
  return {
    outstandingCents,
    nextDueDate: new Date(Date.now() + 14 * 86400000),
    status: outstandingCents > 0 ? 'due_soon' : 'current',
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

  const projects = await loadProjects(accountId, contactId)
  let activityList = await loadClientActivities(accountId, contactId)

  if (activityList.length === 0 && projects.length > 0) {
    activityList = [
      {
        id: 'activity-welcome',
        body: 'Your project workspace is ready. Track progress, deliverables, and approvals here.',
        activityType: 'portal_update',
        createdAt: new Date(),
      },
      ...projects.slice(0, 2).map((p, i) => ({
        id: `activity-${p.id}`,
        body: `${p.title} moved to ${p.stageLabel}.`,
        activityType: 'stage_update',
        createdAt: new Date(Date.now() - (i + 1) * 86400000),
      })),
    ]
  }

  const deliverables = deriveDeliverables(projects)
  const approvals = deriveApprovals(activityList)
  const billing = deriveBilling(projects)

  return {
    contactFirstName: contact.firstName,
    contactLastName: contact.lastName,
    projects,
    activities: activityList,
    deliverables,
    approvals,
    billing,
  }
}

export async function findPreviewContactId(accountId: string): Promise<string | null> {
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
  const portalUrl = account
    ? derivePortalUrl(account.slug, account.portalDomain)
    : derivePortalUrl('workspace', null)

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
    portalEnabledCount: enabledRow?.count ?? 0,
    previewContactName,
  }
}
