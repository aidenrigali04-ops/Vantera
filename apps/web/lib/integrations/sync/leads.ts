import { db } from '@/lib/db/client'
import { getExternalId, withExternalId } from '@/lib/integrations/enrichment'
import {
  fetchGoHighLevelContacts,
  createGoHighLevelContact,
} from '@/lib/integrations/gohighlevel/client'
import {
  fetchHubSpotContacts,
  createHubSpotContact,
} from '@/lib/integrations/hubspot/client'
import { findCrmCredential } from '@/lib/integrations/queries'
import {
  fetchSalesforceLeads,
  createSalesforceLead,
} from '@/lib/integrations/salesforce/client'
import type { CrmLeadRecord, CrmProvider, CrmSyncResult } from '@/lib/integrations/types'
import { leadSourceForProvider } from '@/lib/integrations/types'
import { activities, leads } from '@vantera/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

async function fetchCrmRecords(
  provider: CrmProvider,
  accessToken: string,
  metadata: Record<string, string>,
  limit: number,
): Promise<CrmLeadRecord[]> {
  switch (provider) {
    case 'hubspot':
      return fetchHubSpotContacts(accessToken, limit)
    case 'gohighlevel':
      return fetchGoHighLevelContacts(accessToken, metadata.locationId ?? '', limit)
    case 'salesforce':
      return fetchSalesforceLeads(accessToken, metadata.instanceUrl ?? '', limit)
  }
}

async function createCrmRecord(
  provider: CrmProvider,
  accessToken: string,
  metadata: Record<string, string>,
  record: Omit<CrmLeadRecord, 'externalId'>,
): Promise<string> {
  switch (provider) {
    case 'hubspot':
      return createHubSpotContact(accessToken, record)
    case 'gohighlevel':
      return createGoHighLevelContact(accessToken, metadata.locationId ?? '', record)
    case 'salesforce':
      return createSalesforceLead(accessToken, metadata.instanceUrl ?? '', record)
  }
}

export async function importLeadsFromCrm(
  accountId: string,
  userId: string,
  provider: CrmProvider,
  limit = 100,
): Promise<CrmSyncResult> {
  const credential = await findCrmCredential(accountId, provider)
  if (!credential?.accessToken) {
    return { imported: 0, updated: 0, skipped: 0, errors: ['CRM not connected'] }
  }

  const metadata = (credential.metadata ?? {}) as Record<string, string>
  const result: CrmSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] }

  let records: CrmLeadRecord[] = []
  try {
    records = await fetchCrmRecords(provider, credential.accessToken, metadata, limit)
  } catch (error) {
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [error instanceof Error ? error.message : 'Import failed'],
    }
  }

  for (const record of records) {
    if (!record.company?.trim() && !record.email?.trim()) {
      result.skipped! += 1
      continue
    }

    const company = record.company?.trim() || record.email?.split('@')[1] || 'Unknown company'

    const [existingByExternal] = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.accountId, accountId),
          isNull(leads.deletedAt),
          sql`${leads.enrichment}->'externalIds'->>${provider} = ${record.externalId}`,
        ),
      )
      .limit(1)

    let existing = existingByExternal

    if (!existing && record.email) {
      const [existingByEmail] = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            isNull(leads.deletedAt),
            sql`lower(${leads.email}) = ${record.email.toLowerCase()}`,
          ),
        )
        .limit(1)
      existing = existingByEmail
    }

    const enrichment = withExternalId(existing?.enrichment, provider, record.externalId, 'import')

    if (existing) {
      await db
        .update(leads)
        .set({
          firstName: record.firstName ?? existing.firstName,
          lastName: record.lastName ?? existing.lastName,
          email: record.email ?? existing.email,
          phone: record.phone ?? existing.phone,
          title: record.title ?? existing.title,
          company,
          linkedinUrl: record.linkedinUrl ?? existing.linkedinUrl,
          enrichment,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id))
      result.updated! += 1
      continue
    }

    const [created] = await db
      .insert(leads)
      .values({
        accountId,
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        phone: record.phone,
        title: record.title,
        company,
        linkedinUrl: record.linkedinUrl,
        source: leadSourceForProvider(provider),
        ownerId: userId,
        enrichment,
      })
      .returning({ id: leads.id })

    await db.insert(activities).values({
      accountId,
      leadId: created!.id,
      actorType: 'automation',
      actorId: userId,
      activityType: 'lead_imported',
      body: `Imported from ${provider}`,
      metadata: { provider, externalId: record.externalId },
    })

    result.imported! += 1
  }

  return result
}

export async function exportLeadsToCrm(
  accountId: string,
  userId: string,
  provider: CrmProvider,
  leadIds?: string[],
): Promise<CrmSyncResult> {
  const credential = await findCrmCredential(accountId, provider)
  if (!credential?.accessToken) {
    return { exported: 0, skipped: 0, errors: ['CRM not connected'] }
  }

  const metadata = (credential.metadata ?? {}) as Record<string, string>
  const result: CrmSyncResult = { exported: 0, skipped: 0, errors: [] }

  const conditions = [eq(leads.accountId, accountId), isNull(leads.deletedAt)]
  if (leadIds && leadIds.length > 0) {
    conditions.push(inArray(leads.id, leadIds))
  }

  const openLeads = await db
    .select()
    .from(leads)
    .where(and(...conditions))
    .limit(500)

  const targets =
    leadIds && leadIds.length > 0
      ? openLeads
      : openLeads.filter((lead) => !getExternalId(lead.enrichment, provider))

  for (const lead of targets) {
    if (!lead.email && !lead.phone) {
      result.skipped! += 1
      continue
    }

    try {
      const externalId = await createCrmRecord(provider, credential.accessToken, metadata, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        title: lead.title,
        company: lead.company,
        linkedinUrl: lead.linkedinUrl,
      })

      await db
        .update(leads)
        .set({
          enrichment: withExternalId(lead.enrichment, provider, externalId, 'export'),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))

      await db.insert(activities).values({
        accountId,
        leadId: lead.id,
        actorType: userId ? 'user' : 'automation',
        actorId: userId,
        activityType: 'lead_exported',
        body: `Exported to ${provider}`,
        metadata: { provider, externalId },
      })

      result.exported! += 1
    } catch (error) {
      result.errors.push(
        `${lead.company}: ${error instanceof Error ? error.message : 'Export failed'}`,
      )
    }
  }

  return result
}
