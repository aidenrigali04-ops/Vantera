import { assembleAgentPrompt } from '@/lib/agents/prompt-loader'
import { callModel, parseJsonResponse } from '@/lib/ai/client'
import type { ProspectLead } from '@/lib/aspire/types'
import {
  buildLeadProspectEnrichment,
  mergeLeadEnrichment,
  type LeadProspectEnrichment,
} from '@/lib/leads/enrichment'
import { db } from '@/lib/db/client'
import { leadProfiles, leads } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

const PROFILE_SYSTEM = `You enrich B2B leads for outbound sales. Return ONLY valid JSON:
{
  "disc": "D" | "I" | "S" | "C",
  "awarenessLevel": 1-5,
  "topTriggers": ["string", "..."],
  "primaryFear": "one sentence",
  "egoIdentity": "one sentence",
  "openingHook": "one sentence opener for email",
  "doNot": "one thing to avoid in outreach",
  "enrichmentInsights": ["firmographic or intent insight", "..."]
}
Infer DISC from title/seniority. Use company size and industry when provided.`

type ProfilePayload = {
  disc: string
  awarenessLevel: number
  topTriggers: string[]
  primaryFear: string
  egoIdentity: string
  openingHook: string
  doNot: string
  enrichmentInsights?: string[]
}

/**
 * Firmographic enrichment + psychographic profile for scout/Aspire pipeline leads.
 * Runs inside sdr-lead-profiler before sequence drafting.
 */
export async function enrichAndProfileLead(input: {
  accountId: string
  leadId: string
  aspireData: ProspectLead | null
  icpScore: number
  icpSignals: string[]
  source: LeadProspectEnrichment['source']
}): Promise<void> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.accountId, input.accountId)))
    .limit(1)

  if (!lead) return

  const person: ProspectLead = input.aspireData ?? {
    id: String(lead.id),
    firstName: lead.firstName ?? '',
    lastName: lead.lastName ?? '',
    title: lead.title ?? '',
    email: lead.email,
    phone: lead.phone,
    linkedinUrl: lead.linkedinUrl,
    organizationName: lead.company,
    organizationId: null,
    websiteUrl: null,
    city: null,
    state: null,
    employeeCount: null,
    revenue: null,
    industry:
      typeof (lead.enrichment as Record<string, unknown>)?.industry === 'string'
        ? ((lead.enrichment as Record<string, unknown>).industry as string)
        : null,
    technologies: [],
    photoUrl: lead.avatarUrl,
  }

  const baseEnrichment = buildLeadProspectEnrichment(
    person,
    input.icpScore,
    input.icpSignals,
    input.source,
  )

  const callContext = [
    `Lead: ${person.firstName} ${person.lastName}`,
    `Title: ${person.title}`,
    `Company: ${person.organizationName}`,
    person.industry ? `Industry: ${person.industry}` : null,
    person.employeeCount != null ? `Employees: ${person.employeeCount}` : null,
    person.revenue != null ? `Revenue: ${person.revenue}` : null,
    person.technologies.length ? `Technologies: ${person.technologies.join(', ')}` : null,
    `ICP score: ${input.icpScore}`,
    input.icpSignals.length ? `ICP signals: ${input.icpSignals.slice(0, 6).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  let profilePayload: ProfilePayload | null = null

  try {
    const { system, user } = await assembleAgentPrompt({
      accountId: input.accountId,
      agentId: 'message_drafter',
      taskInstructions: PROFILE_SYSTEM,
      callContext,
    })

    const result = await callModel({
      accountId: input.accountId,
      toolName: 'enrich-profile-lead',
      system,
      user,
      maxTokens: 900,
      timeoutMs: 45_000,
    })

    if (result.ok) {
      profilePayload = parseJsonResponse<ProfilePayload>(result.text, (raw) => {
        if (!raw || typeof raw !== 'object') return null
        const r = raw as Record<string, unknown>
        if (typeof r.disc !== 'string' || !r.openingHook) return null
        return {
          disc: String(r.disc).slice(0, 1).toUpperCase(),
          awarenessLevel: Number(r.awarenessLevel) || 3,
          topTriggers: Array.isArray(r.topTriggers)
            ? r.topTriggers.filter((t): t is string => typeof t === 'string').slice(0, 5)
            : [],
          primaryFear: String(r.primaryFear ?? ''),
          egoIdentity: String(r.egoIdentity ?? ''),
          openingHook: String(r.openingHook ?? ''),
          doNot: String(r.doNot ?? ''),
          enrichmentInsights: Array.isArray(r.enrichmentInsights)
            ? r.enrichmentInsights.filter((t): t is string => typeof t === 'string').slice(0, 6)
            : [],
        }
      })
    }
  } catch (error) {
    console.error('[enrichAndProfileLead] profile model failed:', error)
  }

  const enriched: LeadProspectEnrichment = {
    ...baseEnrichment,
    profile: profilePayload
      ? {
          disc: profilePayload.disc,
          awarenessLevel: profilePayload.awarenessLevel,
          topTriggers: profilePayload.topTriggers,
          primaryFear: profilePayload.primaryFear,
          openingHook: profilePayload.openingHook,
          profiledAt: new Date().toISOString(),
        }
      : undefined,
    icpSignals: [
      ...(baseEnrichment.icpSignals ?? []),
      ...(profilePayload?.enrichmentInsights ?? []),
    ].slice(0, 12),
  }

  await db
    .update(leads)
    .set({
      avatarUrl: person.photoUrl ?? lead.avatarUrl,
      enrichment: mergeLeadEnrichment(
        lead.enrichment as Record<string, unknown>,
        enriched,
      ),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, input.leadId))

  if (profilePayload) {
    await db
      .insert(leadProfiles)
      .values({
        accountId: input.accountId,
        leadId: input.leadId,
        disc: profilePayload.disc,
        awarenessLevel: profilePayload.awarenessLevel,
        topTriggers: profilePayload.topTriggers,
        primaryFear: profilePayload.primaryFear,
        egoIdentity: profilePayload.egoIdentity,
        openingHook: profilePayload.openingHook,
        doNot: profilePayload.doNot,
      })
      .onConflictDoUpdate({
        target: leadProfiles.leadId,
        set: {
          disc: profilePayload.disc,
          awarenessLevel: profilePayload.awarenessLevel,
          topTriggers: profilePayload.topTriggers,
          primaryFear: profilePayload.primaryFear,
          egoIdentity: profilePayload.egoIdentity,
          openingHook: profilePayload.openingHook,
          doNot: profilePayload.doNot,
          profiledAt: new Date(),
        },
      })
  }
}
