'use server'

import { bootstrapBusinessContext } from '@/lib/ai'
import { seedSampleWorkspaceIfEmpty } from '@/lib/sample-data/seed'
import { personalizeVoiceWithAI } from '@/lib/ai/personalize-voice'
import { getAdminSession } from '@/lib/auth/session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { env, requireEnv } from '@/lib/env'
import {
  fetchAccountById,
  markOnboardingComplete,
  patchAccountRow,
} from '@/lib/onboarding/account-store'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import {
  integrationCredentials,
  personalizeTemplate,
  users,
  type OnboardingProfile,
  type VerticalTemplateData,
  type VoiceTone,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
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

type Provider =
  | 'stripe'
  | 'twilio'
  | 'quickbooks'
  | 'google_calendar'
  | 'hubspot'
  | 'gohighlevel'

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

/**
 * Next.js' `redirect()` throws a special Error with `digest` starting with
 * "NEXT_REDIRECT". When that bubbles up through a Server Action, the
 * framework intercepts it and tells the client to navigate. If we swallow
 * it in a generic try/catch we'd convert a redirect into a bogus error
 * string that lands in the UI as e.g. "NEXT_REDIRECT;/auth/login;303"
 * — and the user would be stuck on a step with no way to recover. Call
 * this in every catch block before treating the error as a real failure.
 */
function isNextRedirectError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

/**
 * Same idea for `notFound()`. Less common in our flow but cheap to handle.
 */
function isNextNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_NOT_FOUND')
}

/** Throw if `error` is a framework-internal signal that should bubble up. */
function rethrowFrameworkSignals(error: unknown): void {
  if (isNextRedirectError(error) || isNextNotFoundError(error)) throw error
}

async function assertOwnAccount(): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>
  accountId: string
}> {
  const session = await getAdminSession()

  if (!session) {
    throw new Error('Your session expired. Refresh the page and sign in again.')
  }

  const accountId = String(session.accountId).trim()
  if (!accountId) {
    throw new Error('Your workspace session is invalid. Sign out and sign in again.')
  }

  return { session, accountId }
}

export async function updateVertical(
  clientAccountId: string,
  vertical: string,
): Promise<ActionResult<{ vertical: Vertical }>> {
  try {
    void clientAccountId
    const { accountId } = await assertOwnAccount()

    if (!VERTICAL_VALUES.includes(vertical as Vertical)) {
      return err('Invalid business type')
    }

    const saved = await patchAccountRow(accountId, { vertical })

    if (!saved.ok) {
      return err(saved.message)
    }

    revalidatePath('/admin/onboarding')

    return { success: true, data: { vertical: vertical as Vertical } }
  } catch (error) {
    rethrowFrameworkSignals(error)
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
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()

    const parsed = brandingSchema.safeParse(data)

    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid branding data')
    }

    const saved = await patchAccountRow(workspaceId, {
      brand_logo_url: parsed.data.logoUrl ?? null,
      brand_primary_color: parsed.data.primaryColor,
      brand_secondary_color: parsed.data.secondaryColor,
      portal_domain:
        parsed.data.portalDomain && parsed.data.portalDomain.length > 0
          ? parsed.data.portalDomain
          : null,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    return { success: true, data: { saved: true } }
  } catch (error) {
    rethrowFrameworkSignals(error)
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

function normalizeFallbackAccount(
  accountId: string,
  branding: ReturnType<typeof getBrandingFromHeaders>,
): NonNullable<Awaited<ReturnType<typeof fetchAccountById>>> {
  return {
    id: accountId,
    slug: '',
    name: branding.businessName || 'Workspace',
    vertical: branding.vertical || 'agency',
    plan: branding.plan || 'team',
    brand_logo_url: branding.logoUrl,
    brand_primary_color: branding.primaryColor,
    brand_secondary_color: branding.secondaryColor,
    portal_domain: branding.portalDomain || null,
    timezone: 'America/Los_Angeles',
    booking_link: null,
    review_link: null,
    payment_link: null,
    emergency_line: null,
    business_hours_start: null,
    business_hours_end: null,
    voice_preference: null,
    active_template_id: null,
    onboarding_completed_at: null,
  }
}

async function buildOnboardingProfile(
  accountId: string,
  ownerUserId: string,
): Promise<OnboardingProfile> {
  const account =
    (await fetchAccountById(accountId)) ??
    normalizeFallbackAccount(accountId, getBrandingFromHeaders(headers()))

  const admin = getSupabaseAdmin()

  const { data: owner, error: ownerError } = await admin
    .from('users')
    .select('full_name, email')
    .eq('id', ownerUserId)
    .maybeSingle()

  if (ownerError) {
    throw new Error(ownerError.message)
  }

  const { data: credentialRows, error: credError } = await admin
    .from('integration_credentials')
    .select('provider, metadata')
    .eq('account_id', accountId)

  if (credError) {
    throw new Error(credError.message)
  }

  const twilioRow = (credentialRows ?? []).find((row) => row.provider === 'twilio')
  const hasTwilio = Boolean(twilioRow)
  const hasStripe = (credentialRows ?? []).some((row) => row.provider === 'stripe')
  const hasResendEnv = Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.length > 0)

  const twilioPhoneNumber =
    (twilioRow?.metadata as Record<string, string> | undefined)?.phoneNumber ?? null

  const ownerFullName = owner?.full_name ?? null
  const ownerFirstName = ownerFullName ? (ownerFullName.split(/\s+/)[0] ?? null) : null

  return {
    businessName: account.name,
    businessSlug: account.slug,
    ownerFullName,
    ownerFirstName,
    ownerEmail: owner?.email ?? null,
    brandPrimaryColor: account.brand_primary_color ?? '#1648A0',
    portalDomain: account.portal_domain ?? null,
    portalUrl: derivePortalUrl(account.slug, account.portal_domain ?? null),
    appBaseUrl: deriveAppBaseUrl(),
    supportedChannels: {
      sms: hasTwilio,
      email: hasResendEnv,
      portal: true,
    },
    twilioPhoneNumber,
    hasStripe,
    timezone: account.timezone ?? 'America/Los_Angeles',
    voice: isVoiceTone(account.voice_preference) ? account.voice_preference : undefined,
    businessHoursStart: account.business_hours_start ?? undefined,
    businessHoursEnd: account.business_hours_end ?? undefined,
    emergencyLine: account.emergency_line ?? undefined,
    bookingLink: account.booking_link ?? undefined,
    reviewLink: account.review_link ?? undefined,
    paymentLink: account.payment_link ?? undefined,
  }
}

const HTTPS_URL = /^https?:\/\/[^\s]+$/i
const PHONE_REGEX = /^[+0-9 ()-]{7,30}$/

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
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()

    const row = await fetchAccountById(workspaceId)

    if (!row) {
      return err('Account not found')
    }

    return {
      success: true,
      data: {
        voicePreference: isVoiceTone(row.voice_preference) ? row.voice_preference : null,
        businessHoursStart: row.business_hours_start ?? null,
        businessHoursEnd: row.business_hours_end ?? null,
        bookingLink: row.booking_link ?? null,
        reviewLink: row.review_link ?? null,
        paymentLink: row.payment_link ?? null,
        emergencyLine: row.emergency_line ?? null,
      },
    }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to load business profile')
  }
}

export async function updateBusinessProfile(
  accountId: string,
  data: BusinessProfileInput,
): Promise<ActionResult<{ saved: true; rePersonalized: boolean }>> {
  try {
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

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

    const account = await fetchAccountById(workspaceId)
    if (!account) {
      return err('Account not found')
    }

    const saved = await patchAccountRow(workspaceId, {
      voice_preference: normalized.voicePreference,
      business_hours_start: normalized.businessHoursStart,
      business_hours_end: normalized.businessHoursEnd,
      booking_link: normalized.bookingLink,
      review_link: normalized.reviewLink,
      payment_link: normalized.paymentLink,
      emergency_line: normalized.emergencyLine,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    // If the user already applied a template, re-run personalization so the
    // new voice / hours / links flow into the existing automations.
    let rePersonalized = false
    if (account.active_template_id) {
      try {
        await applyTemplateForAccount(workspaceId, account.active_template_id, session.userId)
        rePersonalized = true
      } catch {
        rePersonalized = false
      }
    }

    return { success: true, data: { saved: true, rePersonalized } }
  } catch (error) {
    rethrowFrameworkSignals(error)
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
    const session = await getAdminSession()
    if (!session) {
      throw new Error('Your session expired. Refresh the page and sign in again.')
    }

    if (!VERTICAL_VALUES.includes(vertical as Vertical)) {
      return err('Invalid business type')
    }

    const admin = getSupabaseAdmin()
    const { data: rows, error } = await admin
      .from('vertical_templates')
      .select('id, record_type, template_data')
      .eq('vertical', vertical)
      .eq('is_active', true)

    if (error) {
      return err(error.message)
    }

    return {
      success: true,
      data: (rows ?? []).map((row) => ({
        id: row.id,
        recordType: row.record_type,
        templateData: row.template_data as VerticalTemplateData,
      })),
    }
  } catch (error) {
    rethrowFrameworkSignals(error)
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
  const admin = getSupabaseAdmin()

  const { data: template, error: templateError } = await admin
    .from('vertical_templates')
    .select('record_type, template_data')
    .eq('id', templateId)
    .maybeSingle()

  if (templateError) {
    throw new Error(templateError.message)
  }

  if (!template) {
    throw new Error('Template not found')
  }

  const rawData = template.template_data as VerticalTemplateData

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

  const { error: deleteStagesError } = await admin
    .from('stage_definitions')
    .delete()
    .eq('account_id', accountId)

  if (deleteStagesError) {
    throw new Error(deleteStagesError.message)
  }

  const { error: deleteAutomationsError } = await admin
    .from('automations')
    .delete()
    .eq('account_id', accountId)

  if (deleteAutomationsError) {
    throw new Error(deleteAutomationsError.message)
  }

  if (stages.length > 0) {
    const { error: insertStagesError } = await admin.from('stage_definitions').insert(
      stages.map((stage, index) => ({
        account_id: accountId,
        record_type: stage.recordType ?? template.record_type,
        label: stage.label,
        position: stage.position ?? index,
        color: stage.color ?? '#64748B',
        triggers_automation: stage.triggersAutomation ?? true,
        is_terminal_win: stage.isTerminalWin ?? false,
        is_terminal_loss: stage.isTerminalLoss ?? false,
      })),
    )

    if (insertStagesError) {
      throw new Error(insertStagesError.message)
    }

    stageCount = stages.length
  }

  if (flowAutomations.length > 0) {
    const { error: insertAutomationsError } = await admin.from('automations').insert(
      flowAutomations.map((flow) => ({
        account_id: accountId,
        name: flow.name,
        trigger_event: flow.triggerEvent,
        trigger_conditions: flow.triggerConditions ?? {},
        actions: (flow.actions ?? []) as Array<Record<string, unknown>>,
        template_ref: flow.templateRef ?? null,
        is_active: false,
      })),
    )

    if (insertAutomationsError) {
      throw new Error(insertAutomationsError.message)
    }

    automationCount = flowAutomations.length
  }

  const saved = await patchAccountRow(accountId, {
    active_template_id: templateId,
  })

  if (!saved.ok) {
    throw new Error(saved.message)
  }

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
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()
    const result = await applyTemplateForAccount(workspaceId, templateId, session.userId)
    return { success: true, data: result }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to apply template')
  }
}

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(ROLE_VALUES, { errorMap: () => ({ message: 'Invalid role' }) }).refine((r) => r !== 'owner', {
    message: 'Cannot invite another owner — each workspace has one owner',
  }),
})

export async function inviteTeamMembers(
  accountId: string,
  members: Array<{ email: string; role: string }>,
): Promise<ActionResult<{ invited: number }>> {
  try {
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

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

    const account = await fetchAccountById(workspaceId)

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
        .where(and(eq(users.email, member.email), eq(users.accountId, workspaceId)))
        .limit(1)

      if (!existing) {
        await db.insert(users).values({
          accountId: workspaceId,
          email: member.email,
          fullName: member.email.split('@')[0] ?? member.email,
          role: member.role,
          isActive: false,
        })
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: member.email,
        // `/auth/callback` is the real route (see app/(auth)/auth/callback/route.ts).
        // The earlier `/api/auth/callback` path doesn't exist and would 404 the
        // invitee's magic link.
        options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
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
    rethrowFrameworkSignals(error)
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
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

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
        accountId: workspaceId,
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
      const acct = await fetchAccountById(workspaceId)

      if (acct?.active_template_id) {
        try {
          await applyTemplateForAccount(workspaceId, acct.active_template_id, session.userId)
          rePersonalized = true
        } catch {
          rePersonalized = false
        }
      }
    }

    return { success: true, data: { saved: true, rePersonalized } }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to save credentials')
  }
}

export async function completeOnboarding(
  accountId: string,
): Promise<ActionResult<{ completed: true; redirectTo: string }>> {
  try {
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

    if (session.role !== 'owner') {
      return err('Only the account owner can complete onboarding')
    }

    const marked = await markOnboardingComplete(workspaceId)
    if (!marked.ok) {
      return err(marked.message)
    }

    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/onboarding')
    revalidatePath('/admin/dashboard')

    void bootstrapBusinessContext(workspaceId, session.userId).catch(() => {
      /* swallow — workflow already logs */
    })

    void seedSampleWorkspaceIfEmpty(workspaceId).catch((err) => {
      console.error('[completeOnboarding] sample seed failed:', err)
    })

    return {
      success: true,
      data: {
        completed: true,
        redirectTo: '/admin/dashboard',
      },
    }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to complete onboarding')
  }
}
