// Business context loader.
//
// Every AI tool prompts against a snapshot of "what we know about this
// account right now". This module assembles that snapshot from live DB rows
// plus any persisted `ai_memory` entries. It is intentionally cheap (~3-5
// indexed queries) so it can be re-built on every tool call without
// caching gymnastics.
//
// Shape:
//
//   BusinessContext = {
//     profile           — OnboardingProfile (existing personalization profile)
//     verticalLabel     — human-readable label for prompts
//     templateRefs      — automation templateRefs currently active
//     stagesByRecord    — pipeline stages keyed by record type
//     metrics           — small set of counts for activity awareness
//     storedMemory      — any persisted account-level memory rows
//   }
//
// The `toPromptContext()` helper renders this into a compact string suitable
// for embedding in a system or user prompt. Tools should always include this
// header so their reasoning is grounded.

import { db } from '@/lib/db/client'
import {
  accounts,
  aiMemory,
  automations,
  contacts,
  integrationCredentials,
  records,
  stageDefinitions,
  users,
  type OnboardingProfile,
  type VoiceTone,
} from '@vantera/db'
import { and, count, eq, sql } from 'drizzle-orm'

const VOICE_VALUES = ['friendly', 'professional', 'urgent'] as const satisfies readonly VoiceTone[]
function isVoiceTone(value: unknown): value is VoiceTone {
  return typeof value === 'string' && (VOICE_VALUES as readonly string[]).includes(value)
}

const VERTICAL_LABELS: Record<string, string> = {
  agency: 'creative / marketing agency',
  hvac: 'HVAC service company',
  landscaping: 'landscaping company',
  plumbing: 'plumbing service company',
  construction: 'construction / remodel contractor',
  property_mgmt: 'property management company',
  real_estate: 'real estate brokerage',
}

export type BusinessMetrics = {
  contactCount: number
  recordCount: number
  openRecordCount: number
  recordsLast30Days: number
  automationCount: number
  activeAutomationCount: number
}

export type StoredMemoryRow = {
  id: string
  kind: string
  subjectType: string
  subjectId: string
  summary: string
  confidence: number
  version: number
  updatedAt: Date
}

export type BusinessContext = {
  accountId: string
  profile: OnboardingProfile
  vertical: string
  verticalLabel: string
  templateRefs: string[]
  stagesByRecordType: Record<string, string[]>
  metrics: BusinessMetrics
  storedMemory: StoredMemoryRow[]
}

const HTTPS_OR_NULL = (value: string | null | undefined): string | undefined => value ?? undefined

function deriveAppBaseUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, '')
}

function derivePortalUrl(slug: string, portalDomain: string | null, appUrl: string): string {
  if (portalDomain && portalDomain.length > 0) {
    return `https://${portalDomain.replace(/^https?:\/\//, '')}`
  }
  const parsed = new URL(deriveAppBaseUrl(appUrl))
  return `${parsed.protocol}//${slug}.${parsed.host}`
}

export async function loadBusinessContext(
  accountId: string,
  ownerUserId: string,
  appUrl: string,
  resendKey: string | null,
): Promise<BusinessContext> {
  const [account] = await db
    .select({
      slug: accounts.slug,
      name: accounts.name,
      vertical: accounts.vertical,
      brandPrimaryColor: accounts.brandPrimaryColor,
      portalDomain: accounts.portalDomain,
      timezone: accounts.timezone,
      bookingLink: accounts.bookingLink,
      reviewLink: accounts.reviewLink,
      paymentLink: accounts.paymentLink,
      emergencyLine: accounts.emergencyLine,
      businessHoursStart: accounts.businessHoursStart,
      businessHoursEnd: accounts.businessHoursEnd,
      voicePreference: accounts.voicePreference,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account) {
    throw new Error(`Account ${accountId} not found while loading business context`)
  }

  const [owner] = await db
    .select({ fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, ownerUserId))
    .limit(1)

  const credentialRows = await db
    .select({ provider: integrationCredentials.provider, metadata: integrationCredentials.metadata })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.accountId, accountId))

  const twilioRow = credentialRows.find((row) => row.provider === 'twilio')
  const hasTwilio = Boolean(twilioRow)
  const hasStripe = credentialRows.some((row) => row.provider === 'stripe')
  const hasEmail = Boolean(resendKey && resendKey.length > 0)

  const automationRows = await db
    .select({
      templateRef: automations.templateRef,
      isActive: automations.isActive,
    })
    .from(automations)
    .where(eq(automations.accountId, accountId))

  const stageRows = await db
    .select({
      recordType: stageDefinitions.recordType,
      label: stageDefinitions.label,
      position: stageDefinitions.position,
    })
    .from(stageDefinitions)
    .where(eq(stageDefinitions.accountId, accountId))
    .orderBy(stageDefinitions.position)

  const stagesByRecordType: Record<string, string[]> = {}
  for (const row of stageRows) {
    const list = stagesByRecordType[row.recordType] ?? []
    list.push(row.label)
    stagesByRecordType[row.recordType] = list
  }

  const [contactCountRow] = await db
    .select({ value: count() })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), sql`${contacts.deletedAt} IS NULL`))

  const [recordCountRow] = await db
    .select({ value: count() })
    .from(records)
    .where(and(eq(records.accountId, accountId), sql`${records.deletedAt} IS NULL`))

  const [openRecordCountRow] = await db
    .select({ value: count() })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        sql`${records.deletedAt} IS NULL`,
        sql`${records.completedAt} IS NULL`,
      ),
    )

  const [recordsLast30Row] = await db
    .select({ value: count() })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        sql`${records.createdAt} >= now() - interval '30 days'`,
      ),
    )

  const memoryRows = await db
    .select({
      id: aiMemory.id,
      kind: aiMemory.kind,
      subjectType: aiMemory.subjectType,
      subjectId: aiMemory.subjectId,
      summary: aiMemory.summary,
      confidence: aiMemory.confidence,
      version: aiMemory.version,
      updatedAt: aiMemory.updatedAt,
    })
    .from(aiMemory)
    .where(eq(aiMemory.accountId, accountId))

  const ownerFullName = owner?.fullName ?? null
  const ownerFirstName = ownerFullName ? (ownerFullName.split(/\s+/)[0] ?? null) : null

  const profile: OnboardingProfile = {
    businessName: account.name,
    businessSlug: account.slug,
    ownerFullName,
    ownerFirstName,
    ownerEmail: owner?.email ?? null,
    brandPrimaryColor: account.brandPrimaryColor ?? '#1648A0',
    portalDomain: account.portalDomain ?? null,
    portalUrl: derivePortalUrl(account.slug, account.portalDomain ?? null, appUrl),
    appBaseUrl: deriveAppBaseUrl(appUrl),
    supportedChannels: {
      sms: hasTwilio,
      email: hasEmail,
      portal: true,
    },
    twilioPhoneNumber:
      (twilioRow?.metadata as Record<string, string> | undefined)?.phoneNumber ?? null,
    hasStripe,
    timezone: account.timezone ?? 'America/Los_Angeles',
    voice: isVoiceTone(account.voicePreference) ? account.voicePreference : undefined,
    businessHoursStart: account.businessHoursStart ?? undefined,
    businessHoursEnd: account.businessHoursEnd ?? undefined,
    emergencyLine: HTTPS_OR_NULL(account.emergencyLine),
    bookingLink: HTTPS_OR_NULL(account.bookingLink),
    reviewLink: HTTPS_OR_NULL(account.reviewLink),
    paymentLink: HTTPS_OR_NULL(account.paymentLink),
  }

  const templateRefs = automationRows
    .map((a) => a.templateRef)
    .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)

  return {
    accountId,
    profile,
    vertical: account.vertical,
    verticalLabel: VERTICAL_LABELS[account.vertical] ?? account.vertical,
    templateRefs,
    stagesByRecordType,
    metrics: {
      contactCount: contactCountRow?.value ?? 0,
      recordCount: recordCountRow?.value ?? 0,
      openRecordCount: openRecordCountRow?.value ?? 0,
      recordsLast30Days: recordsLast30Row?.value ?? 0,
      automationCount: automationRows.length,
      activeAutomationCount: automationRows.filter((a) => a.isActive).length,
    },
    storedMemory: memoryRows,
  }
}

/**
 * Render the context as a compact prompt header. Keep it under ~600 tokens so
 * tools have room for their own per-call instructions and data.
 */
export function toPromptContext(ctx: BusinessContext): string {
  const lines: string[] = []
  lines.push(`Business: ${ctx.profile.businessName} — ${ctx.verticalLabel}`)
  if (ctx.profile.ownerFullName) lines.push(`Owner: ${ctx.profile.ownerFullName}`)
  lines.push(`Timezone: ${ctx.profile.timezone}`)
  if (ctx.profile.voice) lines.push(`Voice preference: ${ctx.profile.voice}`)
  if (
    typeof ctx.profile.businessHoursStart === 'number' &&
    typeof ctx.profile.businessHoursEnd === 'number'
  ) {
    lines.push(
      `Business hours: ${ctx.profile.businessHoursStart}:00 – ${ctx.profile.businessHoursEnd}:00 ${ctx.profile.timezone}`,
    )
  }

  const channels = [
    ctx.profile.supportedChannels.sms ? 'SMS (Twilio)' : null,
    ctx.profile.supportedChannels.email ? 'email (Resend)' : null,
    ctx.profile.supportedChannels.portal ? 'portal' : null,
  ].filter(Boolean) as string[]
  lines.push(`Channels available: ${channels.join(', ') || 'none'}`)
  lines.push(`Payments: ${ctx.profile.hasStripe ? 'Stripe connected' : 'no payment integration'}`)

  if (Object.keys(ctx.stagesByRecordType).length > 0) {
    lines.push('Pipelines:')
    for (const [recordType, stages] of Object.entries(ctx.stagesByRecordType)) {
      lines.push(`  • ${recordType}: ${stages.join(' → ')}`)
    }
  }

  lines.push('Activity:')
  lines.push(
    `  • ${ctx.metrics.contactCount} contacts, ${ctx.metrics.recordCount} records ` +
      `(${ctx.metrics.openRecordCount} open, ${ctx.metrics.recordsLast30Days} new in last 30d)`,
  )
  lines.push(
    `  • ${ctx.metrics.activeAutomationCount}/${ctx.metrics.automationCount} automations active`,
  )

  if (ctx.storedMemory.length > 0) {
    lines.push('Known facts:')
    const accountFacts = ctx.storedMemory
      .filter((m) => m.kind === 'business_context')
      .slice(0, 3)
    for (const fact of accountFacts) {
      lines.push(`  • [${fact.confidence}%] ${fact.summary}`)
    }
  }

  return lines.join('\n')
}
