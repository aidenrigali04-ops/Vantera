import { db } from '@/lib/db/client'
import {
  parseCampaignMetrics,
  parseCampaignWorkflow,
  type CampaignWithStats,
  type EnrollmentWithLead,
} from '@/lib/outreach/types'
import {
  leads,
  outreachCampaignEnrollments,
  outreachCampaigns,
  outreachCampaignSteps,
} from '@vantera/db'
import { and, asc, desc, eq, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm'

export async function findOutreachCampaigns(accountId: string): Promise<CampaignWithStats[]> {
  const rows = await db
    .select()
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.accountId, accountId), isNull(outreachCampaigns.deletedAt)))
    .orderBy(desc(outreachCampaigns.updatedAt))

  return rows.map((row) => ({
    ...row,
    workflow: parseCampaignWorkflow(row.workflow),
    metrics: parseCampaignMetrics(row.metrics),
  }))
}

export async function findOutreachCampaignById(
  accountId: string,
  campaignId: string,
): Promise<CampaignWithStats | null> {
  const [row] = await db
    .select()
    .from(outreachCampaigns)
    .where(
      and(
        eq(outreachCampaigns.accountId, accountId),
        eq(outreachCampaigns.id, campaignId),
        isNull(outreachCampaigns.deletedAt),
      ),
    )
    .limit(1)

  if (!row) return null

  return {
    ...row,
    workflow: parseCampaignWorkflow(row.workflow),
    metrics: parseCampaignMetrics(row.metrics),
  }
}

export async function findCampaignEnrollments(
  accountId: string,
  campaignId: string,
): Promise<EnrollmentWithLead[]> {
  const rows = await db
    .select({ enrollment: outreachCampaignEnrollments, lead: leads })
    .from(outreachCampaignEnrollments)
    .innerJoin(leads, eq(leads.id, outreachCampaignEnrollments.leadId))
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, accountId),
        eq(outreachCampaignEnrollments.campaignId, campaignId),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(outreachCampaignEnrollments.enrolledAt))

  return rows.map((row) => ({ ...row.enrollment, lead: row.lead }))
}

export async function findDueCampaignSteps(
  accountId: string,
  limit = 50,
  options?: { campaignIds?: string[]; excludeCampaignIds?: string[] },
) {
  const campaignIds = options?.campaignIds
  const excludeCampaignIds = options?.excludeCampaignIds

  const filters = [
    eq(outreachCampaignSteps.accountId, accountId),
    eq(outreachCampaignSteps.status, 'pending'),
    lte(outreachCampaignSteps.sendAt, new Date()),
    sql`COALESCE(${outreachCampaignSteps.metadata}->>'manualSend', 'false') <> 'true'`,
  ]

  if (campaignIds && campaignIds.length > 0) {
    filters.push(inArray(outreachCampaignSteps.campaignId, campaignIds))
  }

  if (excludeCampaignIds && excludeCampaignIds.length > 0) {
    filters.push(notInArray(outreachCampaignSteps.campaignId, excludeCampaignIds))
  }

  return db
    .select()
    .from(outreachCampaignSteps)
    .where(and(...filters))
    .orderBy(asc(outreachCampaignSteps.sendAt))
    .limit(limit)
}

export async function findCampaignStepsForCampaign(accountId: string, campaignId: string) {
  return db
    .select()
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        eq(outreachCampaignSteps.campaignId, campaignId),
      ),
    )
    .orderBy(asc(outreachCampaignSteps.stepIndex), asc(outreachCampaignSteps.sendAt))
}

export async function findManualCampaignSteps(accountId: string, campaignId: string) {
  return db
    .select()
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.accountId, accountId),
        eq(outreachCampaignSteps.campaignId, campaignId),
        eq(outreachCampaignSteps.status, 'pending'),
        sql`${outreachCampaignSteps.metadata}->>'manualSend' = 'true'`,
      ),
    )
    .orderBy(asc(outreachCampaignSteps.sendAt))
}

export async function findLeadsByIds(accountId: string, leadIds: string[]) {
  if (leadIds.length === 0) return []
  return db
    .select()
    .from(leads)
    .where(
      and(eq(leads.accountId, accountId), inArray(leads.id, leadIds), isNull(leads.deletedAt)),
    )
}

export async function findLeadsForCampaignPicker(accountId: string, limit = 100) {
  return db
    .select()
    .from(leads)
    .where(and(eq(leads.accountId, accountId), isNull(leads.deletedAt)))
    .orderBy(desc(leads.updatedAt))
    .limit(limit)
}

export async function findAccountsWithDueCampaignSteps(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ accountId: outreachCampaignSteps.accountId })
    .from(outreachCampaignSteps)
    .where(
      and(
        eq(outreachCampaignSteps.status, 'pending'),
        lte(outreachCampaignSteps.sendAt, new Date()),
      ),
    )

  return rows.map((row) => row.accountId)
}

export async function findCampaignStepById(stepId: string) {
  const [row] = await db
    .select()
    .from(outreachCampaignSteps)
    .where(eq(outreachCampaignSteps.id, stepId))
    .limit(1)

  return row ?? null
}

export async function findCampaignStepByProviderMessageId(providerMessageId: string) {
  const [row] = await db
    .select()
    .from(outreachCampaignSteps)
    .where(eq(outreachCampaignSteps.providerMessageId, providerMessageId))
    .limit(1)

  return row ?? null
}

export async function findRecentSentStepForLeadEmail(fromEmail: string) {
  const normalized = fromEmail.trim().toLowerCase()
  if (!normalized) return null

  const [row] = await db
    .select({ step: outreachCampaignSteps })
    .from(outreachCampaignSteps)
    .innerJoin(leads, eq(leads.id, outreachCampaignSteps.leadId))
    .innerJoin(
      outreachCampaignEnrollments,
      eq(outreachCampaignEnrollments.id, outreachCampaignSteps.enrollmentId),
    )
    .where(
      and(
        sql`lower(${leads.email}) = ${normalized}`,
        eq(outreachCampaignSteps.status, 'sent'),
        eq(outreachCampaignEnrollments.status, 'active'),
        isNull(leads.deletedAt),
      ),
    )
    .orderBy(desc(outreachCampaignSteps.sentAt))
    .limit(1)

  return row?.step ?? null
}
