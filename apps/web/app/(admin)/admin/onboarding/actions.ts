'use server'

import { personalizeVoiceWithAI } from '@/lib/ai/personalize-voice'
import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { env, requireEnv } from '@/lib/env'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  accounts,
  automations,
  integrationCredentials,
  personalizeTemplate,
  stageDefinitions,
  users,
  verticalTemplates,
  type OnboardingProfile,
  type VerticalTemplateData,
  type VoiceTone,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { Resend } from 'resend'
import Stripe from 'stripe'
import twilio from 'twilio'
import { z } from 'zod'

const VERTICAL_VALUES = [
  'agency',
  'hvac',
  'landscaping',
  'plumbing',
  'construction',
  'property_mgmt',
  'real_estate',
] as const

type Vertical = (typeof VERTICAL_VALUES)[number]

const ROLE_VALUES = ['owner', 'admin', 'manager', 'staff', 'technician', 'agent'] as const

type Role = (typeof ROLE_VALUES)[number]

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

const PROVIDERS_WITH_VALIDATION = ['stripe', 'twilio'] as const
const PROVIDERS_OAUTH_PLACEHOLDER = ['quickbooks', 'google_calendar', 'hubspot', 'gohighlevel'] as const
type Provider = (typeof PROVIDERS_WITH_VALIDATION)[number] | (typeof PROVIDERS_OAUTH_PLACEHOLDER)[number]

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

async function assertOwnAccount(accountId: string): Promise<{ session: Awaited<ReturnType<typeof requireAdminSession>> }> {
  const session = await requireAdminSession()

  if (session.accountId !== accountId) {
    throw new Error('Account mismatch')
  }

  return { session }
}

export async function updateVertical(
  accountId: string,
  vertical: string,
): Promise<ActionResult<{ vertical: Vertical }>> {
  try {
    await assertOwnAccount(accountId)

    if (!VERTICAL_VALUES.includes(vertical as Vertical)) {
      return err('Invalid business type')
    }

    await db
      .update(accounts)
      .set({ vertical: vertical as Vertical, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))

    return { success: true, data: { vertical: vertical as Vertical } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to update business type')
  }
}

const brandingSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(HEX_COLOR, 'Primary color must be a 6-digit hex value'),
  secondaryColor: z.string().regex(HEX_COLOR, 'Secondary color must be a 6-digit hex value'),
  portalDomain: z.string().regex(DOMAIN_REGEX, 'Invalid domain').optional().or(z.literal('')),
})

export async function updateBranding(
  accountId: string,
  data: {
    logoUrl?: string | null
    primaryColor: string
    secondaryColor: string
    portalDomain?: string
  },
): Promise<ActionResult<{ saved: true }>> {
  try {
    await assertOwnAccount(accountId)

    const parsed = brandingSchema.safeParse(data)

    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid branding data')
    }

    await db
      .update(accounts)
      .set({
        brandLogoUrl: parsed.data.logoUrl ?? null,
        brandPrimaryColor: parsed.data.primaryColor,
        brandSecondaryColor: parsed.data.secondaryColor,
        portalDomain: parsed.data.portalDomain && parsed.data.portalDomain.length > 0 ? parsed.data.portalDomain : null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    return { success: true, data: { saved: true } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to save branding')
  }
}

export type TemplateSummary = {
  id: string
  recordType: string
  templateData: VerticalTemplateData
}

function deriveAppBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
}

function derivePortalUrl(slug: string, portalDomain: string | null): string {
  if (portalDomain && portalDomain.length > 0) {
    return `https://${portalDomain.replace(/^https?:\/\//, '')}`
  }

  const appUrl = new URL(deriveAppBaseUrl())
  // Multi-tenant subdomain convention: <slug>.<app-domain>
  return `${appUrl.protocol}//${slug}.${appUrl.host}`
}

const VOICE_VALUES = ['friendly', 'professional', 'urgent'] as const satisfies readonly VoiceTone[]

function isVoiceTone(value: unknown): value is VoiceTone {
  return typeof value === 'string' && (VOICE_VALUES as readonly string[]).includes(value)
}

async function buildOnboardingProfile(
  accountId: string,
  ownerUserId: string,
): Promise<OnboardingProfile> {
  const [account] = await db
    .select({
      slug: accounts.slug,
      name: accounts.name,
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
    throw new Error('Account not found while building personalization profile')
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
  const hasResendEnv = Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.length > 0)

  const twilioPhoneNumber =
    (twilioRow?.metadata as Record<string, string> | undefined)?.phoneNumber ?? null

  const ownerFullName = owner?.fullName ?? null
  const ownerFirstName = ownerFullName ? (ownerFullName.split(/\s+/)[0] ?? null) : null

  return {
    businessName: account.name,
    businessSlug: account.slug,
    ownerFullName,
    ownerFirstName,
    ownerEmail: owner?.email ?? null,
    brandPrimaryColor: account.brandPrimaryColor ?? '#1648A0',
    portalDomain: account.portalDomain ?? null,
    portalUrl: derivePortalUrl(account.slug, account.portalDomain ?? null),
    appBaseUrl: deriveAppBaseUrl(),
    supportedChannels: {
      // Email is always available when Resend is configured at the env level;
      // SMS only when Twilio is connected for this tenant; portal is always
      // available since every tenant gets a portal.
      sms: hasTwilio,
      email: hasResendEnv,
      portal: true,
    },
    twilioPhoneNumber,
    hasStripe,
    timezone: account.timezone ?? 'America/Los_Angeles',
    voice: isVoiceTone(account.voicePreference) ? account.voicePreference : undefined,
    businessHoursStart: account.businessHoursStart ?? undefined,
    businessHoursEnd: account.businessHoursEnd ?? undefined,
    emergencyLine: account.emergencyLine ?? undefined,
    bookingLink: account.bookingLink ?? undefined,
    reviewLink: account.reviewLink ?? undefined,
    paymentLink: account.paymentLink ?? undefined,
  }
}

const HTTPS_URL = /^https?:\/\/[^\s]+$/i
const PHONE_REGEX = /^[+0-9 ()\-]{7,30}$/

const businessProfileSchema = z
  .object({
    voicePreference: z.enum(VOICE_VALUES).nullable().optional(),
    businessHoursStart: z.number().int().min(0).max(23).nullable().optional(),
    businessHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
    bookingLink: z.string().regex(HTTPS_URL, 'Booking link must be a URL').max(500).nullable().optional(),
    reviewLink: z.string().regex(HTTPS_URL, 'Review link must be a URL').max(500).nullable().optional(),
    paymentLink: z.string().regex(HTTPS_URL, 'Payment link must be a URL').max(500).nullable().optional(),
    emergencyLine: z.string().regex(PHONE_REGEX, 'Emergency line must be a phone number').max(50).nullable().optional(),
  })
  .refine(
    (val) =>
      val.businessHoursStart == null ||
      val.businessHoursEnd == null ||
      val.businessHoursStart < val.businessHoursEnd,
    {
      message: 'Business hours start must be earlier than end',
      path: ['businessHoursStart'],
    },
  )

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>

export type BusinessProfileSnapshot = {
  voicePreference: VoiceTone | null
  businessHoursStart: number | null
  businessHoursEnd: number | null
  bookingLink: string | null
  reviewLink: string | null
  paymentLink: string | null
  emergencyLine: string | null
}

export async function getBusinessProfile(
  accountId: string,
): Promise<ActionResult<BusinessProfileSnapshot>> {
  try {
    await assertOwnAccount(accountId)

    const [row] = await db
      .select({
        voicePreference: accounts.voicePreference,
        businessHoursStart: accounts.businessHoursStart,
        businessHoursEnd: accounts.businessHoursEnd,
        bookingLink: accounts.bookingLink,
        reviewLink: accounts.reviewLink,
        paymentLink: accounts.paymentLink,
        emergencyLine: accounts.emergencyLine,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!row) {
      return err('Account not found')
    }

    return {
      success: true,
      data: {
        voicePreference: isVoiceTone(row.voicePreference) ? row.voicePreference : null,
        businessHoursStart: row.businessHoursStart ?? null,
        businessHoursEnd: row.businessHoursEnd ?? null,
        bookingLink: row.bookingLink ?? null,
        reviewLink: row.reviewLink ?? null,
        paymentLink: row.paymentLink ?? null,
        emergencyLine: row.emergencyLine ?? null,
      },
    }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to load business profile')
  }
}

export async function updateBusinessProfile(
  accountId: string,
  data: BusinessProfileInput,
): Promise<ActionResult<{ saved: true; rePersonalized: boolean }>> {
  try {
    const { session } = await assertOwnAccount(accountId)

    const parsed = businessProfileSchema.safeParse(data)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid business profile')
    }

    const normalized = {
      voicePreference: parsed.data.voicePreference ?? null,
      businessHoursStart: parsed.data.businessHoursStart ?? null,
      businessHoursEnd: parsed.data.businessHoursEnd ?? null,
      bookingLink: emptyToNull(parsed.data.bookingLink),
      reviewLink: emptyToNull(parsed.data.reviewLink),
      paymentLink: emptyToNull(parsed.data.paymentLink),
      emergencyLine: emptyToNull(parsed.data.emergencyLine),
    }

    const [existing] = await db
      .select({ activeTemplateId: accounts.activeTemplateId })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    await db
      .update(accounts)
      .set({
        ...normalized,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))

    // If the user already applied a template, re-run personalization so the
    // new voice / hours / links flow into the existing automations.
    let rePersonalized = false
    if (existing?.activeTemplateId) {
      try {
        await applyTemplateForAccount(accountId, existing.activeTemplateId, session.userId)
        rePersonalized = true
      } catch {
        rePersonalized = false
      }
    }

    return { success: true, data: { saved: true, rePersonalized } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to save business profile')
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export async function getTemplatesForVertical(
  vertical: string,
): Promise<ActionResult<TemplateSummary[]>> {
  try {
    await requireAdminSession()

    if (!VERTICAL_VALUES.includes(vertical as Vertical)) {
      return err('Invalid business type')
    }

    const rows = await db
      .select({
        id: verticalTemplates.id,
        recordType: verticalTemplates.recordType,
        templateData: verticalTemplates.templateData,
      })
      .from(verticalTemplates)
      .where(
        and(
          eq(verticalTemplates.vertical, vertical as Vertical),
          eq(verticalTemplates.isActive, true),
        ),
      )

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        recordType: row.recordType,
        templateData: row.templateData as VerticalTemplateData,
      })),
    }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to load templates')
  }
}

export type ApplyTemplateResult = {
  stageCount: number
  automationCount: number
  droppedAutomationCount: number
  aiRewriteConsidered: number
  aiRewriteApplied: number
  aiRewriteSkipped: boolean
  aiRewriteError?: string
}

// Core apply logic, callable internally without re-running session checks
// (used by re-personalization triggers after Step 6 integration connects).
async function applyTemplateForAccount(
  accountId: string,
  templateId: string,
  ownerUserId: string,
): Promise<ApplyTemplateResult> {
  const [template] = await db
    .select({
      recordType: verticalTemplates.recordType,
      templateData: verticalTemplates.templateData,
    })
    .from(verticalTemplates)
    .where(eq(verticalTemplates.id, templateId))
    .limit(1)

  if (!template) {
    throw new Error('Template not found')
  }

  const rawData = template.templateData as VerticalTemplateData

  // Step 1 — sync personalization: variable substitution, channel downgrade,
  // automation drop, business hours injection.
  const profile = await buildOnboardingProfile(accountId, ownerUserId)
  const syncPersonalized = personalizeTemplate(rawData, profile)

  // Step 2 — AI voice rewrite (opt-in: only if profile.voice is set AND the
  // ANTHROPIC_API_KEY is configured). Non-fatal on failure.
  const { template: personalized, outcome: aiOutcome } = await personalizeVoiceWithAI(
    syncPersonalized,
    profile,
  )

  const stages = Array.isArray(personalized.stages) ? personalized.stages : []
  const flowAutomations = Array.isArray(personalized.automations) ? personalized.automations : []
  const droppedAutomationCount =
    (Array.isArray(rawData.automations) ? rawData.automations.length : 0) - flowAutomations.length

  let stageCount = 0
  let automationCount = 0

  await db.transaction(async (tx) => {
    // HARD DELETE: This is the only place in the codebase where we hard-delete
    // rows instead of soft-deleting. Stage definitions during onboarding have
    // no foreign-key references yet (no records exist on the account at this
    // point), so a hard delete is safe and avoids leaving stale rows behind
    // when a different template is selected. Do NOT copy this pattern.
    await tx.delete(stageDefinitions).where(eq(stageDefinitions.accountId, accountId))

    // Same rationale: clear any prior auto-seeded automations for this
    // account before re-applying. Once the user starts editing automations
    // we'll soft-delete them through the regular admin flow.
    await tx.delete(automations).where(eq(automations.accountId, accountId))

    if (stages.length > 0) {
      await tx.insert(stageDefinitions).values(
        stages.map((stage, index) => ({
          accountId,
          recordType: stage.recordType ?? template.recordType,
          label: stage.label,
          position: stage.position ?? index,
          color: stage.color ?? '#64748B',
          triggersAutomation: stage.triggersAutomation ?? true,
          isTerminalWin: stage.isTerminalWin ?? false,
          isTerminalLoss: stage.isTerminalLoss ?? false,
        })),
      )
      stageCount = stages.length
    }

    if (flowAutomations.length > 0) {
      await tx.insert(automations).values(
        flowAutomations.map((flow) => ({
          accountId,
          name: flow.name,
          triggerEvent: flow.triggerEvent,
          triggerConditions: flow.triggerConditions ?? {},
          actions: (flow.actions ?? []) as Array<Record<string, unknown>>,
          templateRef: flow.templateRef ?? null,
          isActive: false,
        })),
      )
      automationCount = flowAutomations.length
    }

    // Remember which template was applied so integration-connect flows can
    // re-personalize against the freshly connected channels.
    await tx
      .update(accounts)
      .set({ activeTemplateId: templateId, updatedAt: new Date() })
      .where(eq(accounts.id, accountId))
  })

  return {
    stageCount,
    automationCount,
    droppedAutomationCount,
    aiRewriteConsidered: aiOutcome.considered,
    aiRewriteApplied: aiOutcome.applied,
    aiRewriteSkipped: aiOutcome.skipped,
    aiRewriteError: aiOutcome.errorMessage,
  }
}

export async function applyVerticalTemplate(
  accountId: string,
  templateId: string,
): Promise<ActionResult<ApplyTemplateResult>> {
  try {
    const { session } = await assertOwnAccount(accountId)
    const result = await applyTemplateForAccount(accountId, templateId, session.userId)
    return { success: true, data: result }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to apply template')
  }
}

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(ROLE_VALUES, { errorMap: () => ({ message: 'Invalid role' }) }),
})

export async function inviteTeamMembers(
  accountId: string,
  members: Array<{ email: string; role: string }>,
): Promise<ActionResult<{ invited: number }>> {
  try {
    const { session } = await assertOwnAccount(accountId)

    if (session.role !== 'owner') {
      return err('Only the account owner can invite team members')
    }

    if (members.length === 0) {
      return { success: true, data: { invited: 0 } }
    }

    if (members.length > 3) {
      return err('Team plan allows up to 3 invited members')
    }

    const validated: Array<{ email: string; role: Role }> = []
    for (const member of members) {
      const result = inviteSchema.safeParse(member)

      if (!result.success) {
        return err(result.error.issues[0]?.message ?? 'Invalid team member')
      }

      validated.push(result.data)
    }

    const [account] = await db
      .select({
        name: accounts.name,
        portalDomain: accounts.portalDomain,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!account) {
      return err('Account not found')
    }

    const supabase = getSupabaseAdmin()
    const resend = new Resend(requireEnv('RESEND_API_KEY'))
    const fromAddress = `${account.name} <onboarding@${env.NEXT_PUBLIC_APP_DOMAIN}>`

    let invited = 0

    for (const member of validated) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, member.email), eq(users.accountId, accountId)))
        .limit(1)

      if (!existing) {
        await db.insert(users).values({
          accountId,
          email: member.email,
          fullName: member.email.split('@')[0] ?? member.email,
          role: member.role,
          isActive: false,
        })
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: member.email,
        options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback` },
      })

      if (linkError) {
        return err(`Failed to create invite link for ${member.email}`)
      }

      const magicLink = linkData?.properties?.action_link ?? `${env.NEXT_PUBLIC_APP_URL}/auth/login`

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a">
          <h1 style="font-size:20px;margin:0 0 16px">You've been invited to join ${account.name}</h1>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 24px">
            ${account.name} has invited you as a <strong>${member.role}</strong>.
            Click the button below to accept the invitation and set up your account.
          </p>
          <p style="margin:0 0 32px">
            <a href="${magicLink}"
               style="background:#1648A0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500;display:inline-block">
              Accept invitation
            </a>
          </p>
          <p style="font-size:12px;color:#64748b;margin:0">
            If the button doesn't work, copy this link into your browser:<br />
            <span style="word-break:break-all">${magicLink}</span>
          </p>
        </div>
      `

      const { error: sendError } = await resend.emails.send({
        from: fromAddress,
        to: member.email,
        subject: `You've been invited to join ${account.name}`,
        html,
      })

      if (sendError) {
        return err(`Failed to send invite to ${member.email}: ${sendError.message}`)
      }

      invited += 1
    }

    return { success: true, data: { invited } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to invite team members')
  }
}

const credentialsSchema = z.object({
  provider: z.string().min(1),
  credentials: z.record(z.string()),
})

export async function saveIntegrationCredentials(
  accountId: string,
  provider: string,
  credentials: Record<string, string>,
): Promise<ActionResult<{ saved: true; rePersonalized: boolean }>> {
  try {
    const { session } = await assertOwnAccount(accountId)

    const parsed = credentialsSchema.safeParse({ provider, credentials })

    if (!parsed.success) {
      return err('Invalid credentials payload')
    }

    const providerKey = parsed.data.provider.toLowerCase() as Provider

    let accessToken: string | null = null
    const metadata: Record<string, string> = {}

    if (providerKey === 'stripe') {
      const secretKey = parsed.data.credentials.secretKey?.trim()
      const publishableKey = parsed.data.credentials.publishableKey?.trim()

      if (!secretKey) {
        return err('Stripe secret key is required')
      }

      const stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' })

      try {
        await stripe.accounts.retrieve()
      } catch {
        return err('Invalid Stripe credentials')
      }

      accessToken = secretKey
      if (publishableKey) {
        metadata.publishableKey = publishableKey
      }
    } else if (providerKey === 'twilio') {
      const sid = parsed.data.credentials.accountSid?.trim()
      const authToken = parsed.data.credentials.authToken?.trim()
      const phoneNumber = parsed.data.credentials.phoneNumber?.trim()

      if (!sid || !authToken) {
        return err('Twilio Account SID and Auth Token are required')
      }

      try {
        const client = twilio(sid, authToken)
        await client.api.accounts(sid).fetch()
      } catch {
        return err('Invalid Twilio credentials')
      }

      accessToken = authToken
      metadata.accountSid = sid
      if (phoneNumber) {
        metadata.phoneNumber = phoneNumber
      }
    } else {
      return err('This integration is not yet available')
    }

    await db
      .insert(integrationCredentials)
      .values({
        accountId,
        provider: providerKey,
        accessToken,
        metadata,
        isNativeMode: false,
      })
      .onConflictDoUpdate({
        target: [integrationCredentials.accountId, integrationCredentials.provider],
        set: {
          accessToken,
          metadata,
          isNativeMode: false,
          updatedAt: new Date(),
        },
      })

    // After a successful integration connect, re-run template personalization
    // so previously-downgraded actions (e.g. SMS → email when Twilio wasn't
    // connected at Step 4) get restored to their original channel using the
    // newly available capability. No-op if the account hasn't applied a
    // template yet, or if the re-apply fails (we don't want to surface an
    // integration-save failure for a downstream personalization issue).
    let rePersonalized = false
    if (providerKey === 'twilio' || providerKey === 'stripe') {
      const [acct] = await db
        .select({ activeTemplateId: accounts.activeTemplateId })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1)

      if (acct?.activeTemplateId) {
        try {
          await applyTemplateForAccount(accountId, acct.activeTemplateId, session.userId)
          rePersonalized = true
        } catch {
          rePersonalized = false
        }
      }
    }

    return { success: true, data: { saved: true, rePersonalized } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to save credentials')
  }
}

export async function completeOnboarding(
  accountId: string,
): Promise<ActionResult<{ completed: true }>> {
  try {
    const { session } = await assertOwnAccount(accountId)

    if (session.role !== 'owner') {
      return err('Only the account owner can complete onboarding')
    }

    await db
      .update(accounts)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId))

    return { success: true, data: { completed: true } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to complete onboarding')
  }
}
