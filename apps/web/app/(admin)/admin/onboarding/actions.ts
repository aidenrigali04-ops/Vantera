'use server'

import { upsertMemory } from '@/lib/ai/memory'
import { personalizeVoiceWithAI } from '@/lib/ai/personalize-voice'
import { getAdminSession, setAdminSession } from '@/lib/auth/session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { env, requireEnv } from '@/lib/env'
import {
  analyzeBusinessFromDetails,
  ONBOARDING_VERTICALS,
  type BusinessAnalysis,
  type OnboardingVertical,
} from '@/lib/onboarding/analyze-business'
import {
  fetchAccountById,
  markOnboardingComplete,
  patchAccountRow,
  resolveWorkspaceAccountId,
} from '@/lib/onboarding/account-store'
import {
  fetchOnboardingPreviewLeads,
  type PreviewLead,
} from '@/lib/onboarding/preview-leads'
import {
  ONBOARDING_PRICING_PLANS,
  resolveAccountPlan,
  type OnboardingPlanId,
} from '@/lib/onboarding/pricing-plans'
import { provisionOwnerWorkspace } from '@/lib/onboarding/provision-workspace'
import { initSdrCreditAccountFromOnboarding } from '@/lib/sdr/credits'
import {
  trackOnboardingStep,
  type OnboardingStepEvent,
  type OnboardingStepId,
} from '@/lib/onboarding/track-onboarding-step'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import {
  accounts,
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

  let accountId = await resolveWorkspaceAccountId(session.userId)
  if (!accountId && session.role === 'owner') {
    accountId = await provisionOwnerWorkspace(session)
  }
  if (!accountId) {
    throw new Error('Your workspace session is invalid. Sign out and sign in again.')
  }

  if (accountId !== session.accountId) {
    console.warn('[assertOwnAccount] corrected workspace id from users row', {
      jwtAccountId: session.accountId,
      resolvedAccountId: accountId,
      userId: session.userId,
    })
    await setAdminSession({ ...session, accountId })
  }

  return { session: { ...session, accountId }, accountId }
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

const businessNameSchema = z.string().trim().min(2, 'Enter your business name').max(120)
const websiteUrlSchema = z
  .string()
  .trim()
  .min(4, 'Enter your website URL')
  .max(500, 'Website URL is too long')
  .refine(
    (value) => {
      const withProtocol = value.startsWith('http') ? value : `https://${value}`
      try {
        const url = new URL(withProtocol)
        return Boolean(url.hostname.includes('.'))
      } catch {
        return false
      }
    },
    { message: 'Enter a valid website URL' },
  )

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

export async function saveBusinessDetailsAndAnalyze(
  accountId: string,
  input: {
    businessName: string
    websiteUrl: string
    manualVertical?: string | null
  },
): Promise<ActionResult<{ analysis: BusinessAnalysis }>> {
  try {
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()

    const nameParsed = businessNameSchema.safeParse(input.businessName)
    if (!nameParsed.success) {
      return err(nameParsed.error.issues[0]?.message ?? 'Invalid business name')
    }

    const websiteParsed = websiteUrlSchema.safeParse(input.websiteUrl)
    if (!websiteParsed.success) {
      return err(websiteParsed.error.issues[0]?.message ?? 'Invalid website URL')
    }

    const manualVertical =
      input.manualVertical &&
      ONBOARDING_VERTICALS.includes(input.manualVertical as OnboardingVertical)
        ? (input.manualVertical as OnboardingVertical)
        : null

    const analysis = await analyzeBusinessFromDetails({
      accountId: workspaceId,
      businessName: nameParsed.data,
      websiteUrl: websiteParsed.data,
      manualVertical,
    })

    const saved = await patchAccountRow(workspaceId, {
      name: nameParsed.data,
      website_url: normalizeWebsiteUrl(websiteParsed.data),
      vertical: analysis.vertical,
      icp_summary: analysis.icpSummary,
      icp_description: analysis.icpDescription,
      value_proposition: analysis.valueProposition,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    void trackOnboardingStep(workspaceId, 'business_details', 'completed', {
      vertical: analysis.vertical,
    })

    revalidatePath('/admin/onboarding')

    return { success: true, data: { analysis } }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to analyze your business')
  }
}

export async function fetchPreviewLeadsAction(
  accountId: string,
): Promise<ActionResult<{ leads: PreviewLead[] }>> {
  try {
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()
    const account = await fetchAccountById(workspaceId)

    if (!account?.icp_description?.trim()) {
      return err('Complete business details first')
    }

    const { leads, usedStubFallback } = await fetchOnboardingPreviewLeads({
      accountId: workspaceId,
      vertical: (account.vertical as OnboardingVertical) ?? 'agency',
      businessName: account.name,
      icpSummary: account.icp_summary ?? account.icp_description,
    })

    void trackOnboardingStep(workspaceId, 'lead_preview', 'completed', {
      leadCount: leads.length,
      usedStubFallback,
    })

    return { success: true, data: { leads } }
  } catch (error) {
    rethrowFrameworkSignals(error)
    console.error('[fetchPreviewLeadsAction] failed', error)
    return err('Could not find leads. Please try again.')
  }
}

export async function recordOnboardingStepEvent(
  accountId: string,
  step: OnboardingStepId,
  event: OnboardingStepEvent,
): Promise<ActionResult<{ recorded: true }>> {
  try {
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()
    await trackOnboardingStep(workspaceId, step, event)
    return { success: true, data: { recorded: true } }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to record step')
  }
}

export async function completeOnboardingWithPlan(
  accountId: string,
  planId: OnboardingPlanId,
): Promise<ActionResult<{ completed: true; redirectTo: string }>> {
  try {
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

    if (session.role !== 'owner') {
      return err('Only the account owner can complete onboarding')
    }

    const validPlan = ONBOARDING_PRICING_PLANS.some((plan) => plan.id === planId)
    if (!validPlan) {
      return err('Choose a plan to continue')
    }

    const account = await fetchAccountById(workspaceId)
    const icpDescription = account?.icp_description?.trim() ?? ''
    const valueProposition = account?.value_proposition?.trim() ?? ''
    const websiteUrl = account?.website_url?.trim() ?? ''

    if (websiteUrl.length < 4) {
      return err('Complete the business details step first')
    }

    if (icpDescription.length < 20) {
      return err('Confirm your ideal customer profile before finishing setup')
    }

    const [revenueGoal] = await db
      .select({ mrrGoal: accounts.mrrGoal })
      .from(accounts)
      .where(eq(accounts.id, workspaceId))
      .limit(1)

    if (!revenueGoal?.mrrGoal || revenueGoal.mrrGoal <= 0) {
      return err('Set your revenue goal before finishing setup')
    }

    const saved = await patchAccountRow(workspaceId, {
      plan: resolveAccountPlan(planId),
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    const vertical = account?.vertical ?? null
    if (vertical) {
      await applyDefaultTemplateForVertical(workspaceId, vertical, session.userId)
    }

    if (valueProposition.length >= 20) {
      try {
        await upsertMemory({
          accountId: workspaceId,
          kind: 'business_context',
          subjectType: 'account',
          subjectId: workspaceId,
          summary: buildOnboardingBusinessSummary(icpDescription, valueProposition),
          evidence: {
            icpDescription,
            valueProposition,
            websiteUrl: account?.website_url ?? null,
            selectedPlan: planId,
            source: 'onboarding',
          },
          confidence: 85,
        })
      } catch (memoryErr) {
        console.error('[completeOnboardingWithPlan] ai_memory upsert failed', memoryErr)
      }
    }

    try {
      await initSdrCreditAccountFromOnboarding(workspaceId, planId)
    } catch (creditErr) {
      console.error('[completeOnboardingWithPlan] sdr credit init failed', creditErr)
    }

    const marked = await markOnboardingComplete(workspaceId)
    if (!marked.ok) {
      return err(marked.message)
    }

    void trackOnboardingStep(workspaceId, 'subscription', 'completed', { planId })

    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/onboarding')
    revalidatePath('/admin/dashboard')

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

    const portalHost =
      parsed.data.portalDomain && parsed.data.portalDomain.length > 0
        ? parsed.data.portalDomain
        : null

    const saved = await patchAccountRow(workspaceId, {
      brand_logo_url: parsed.data.logoUrl ?? null,
      brand_primary_color: parsed.data.primaryColor,
      brand_secondary_color: parsed.data.secondaryColor,
      portal_domain: portalHost,
      portal_domain_status: portalHost ? 'pending' : 'not_configured',
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

const icpDescriptionSchema = z
  .string()
  .trim()
  .min(20, 'Describe your ideal customer in at least a few sentences')
  .max(2000, 'Keep your ICP under 2000 characters')

const valuePropositionSchema = z
  .string()
  .trim()
  .min(20, 'Describe the value you provide in at least a few sentences')
  .max(2000, 'Keep your answer under 2000 characters')

export type OnboardingProfileSnapshot = {
  icpDescription: string | null
  valueProposition: string | null
}

export async function getOnboardingProfile(
  accountId: string,
): Promise<ActionResult<OnboardingProfileSnapshot>> {
  try {
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()
    const row = await fetchAccountById(workspaceId)

    return {
      success: true,
      data: {
        icpDescription: row?.icp_description ?? null,
        valueProposition: row?.value_proposition ?? null,
      },
    }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to load onboarding profile')
  }
}

export async function saveOnboardingIcp(
  accountId: string,
  icpDescription: string,
): Promise<ActionResult<{ saved: true }>> {
  try {
    void accountId
    const { accountId: workspaceId } = await assertOwnAccount()

    const parsed = icpDescriptionSchema.safeParse(icpDescription)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid ICP description')
    }

    const saved = await patchAccountRow(workspaceId, {
      icp_description: parsed.data,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    void trackOnboardingStep(workspaceId, 'icp', 'completed')

    revalidatePath('/admin/onboarding')
    return { success: true, data: { saved: true } }
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to save ICP')
  }
}

function buildOnboardingBusinessSummary(icpDescription: string, valueProposition: string): string {
  return `Ideal customer: ${icpDescription} Value provided: ${valueProposition}`
}

async function applyDefaultTemplateForVertical(
  accountId: string,
  vertical: string,
  ownerUserId: string,
): Promise<void> {
  if (!VERTICAL_VALUES.includes(vertical as Vertical)) {
    return
  }

  const admin = getSupabaseAdmin()
  const { data: rows, error } = await admin
    .from('vertical_templates')
    .select('id')
    .eq('vertical', vertical)
    .eq('is_active', true)
    .order('record_type', { ascending: true })
    .limit(1)

  if (error || !rows?.[0]?.id) {
    return
  }

  try {
    await applyTemplateForAccount(accountId, rows[0].id, ownerUserId)
  } catch (templateErr) {
    console.error('[finishOnboardingSetup] template apply failed', templateErr)
  }
}

export async function finishOnboardingSetup(
  accountId: string,
  valueProposition: string,
  vertical: string | null,
): Promise<ActionResult<{ completed: true; redirectTo: string }>> {
  try {
    void accountId
    const { session, accountId: workspaceId } = await assertOwnAccount()

    if (session.role !== 'owner') {
      return err('Only the account owner can complete onboarding')
    }

    const parsed = valuePropositionSchema.safeParse(valueProposition)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid value proposition')
    }

    const account = await fetchAccountById(workspaceId)
    const icpDescription = account?.icp_description?.trim() ?? ''

    if (icpDescription.length < 20) {
      return err('Complete your ideal customer profile on the previous step first')
    }

    const saved = await patchAccountRow(workspaceId, {
      value_proposition: parsed.data,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    if (vertical) {
      await applyDefaultTemplateForVertical(workspaceId, vertical, session.userId)
    }

    try {
      await upsertMemory({
        accountId: workspaceId,
        kind: 'business_context',
        subjectType: 'account',
        subjectId: workspaceId,
        summary: buildOnboardingBusinessSummary(icpDescription, parsed.data),
        evidence: {
          icpDescription,
          valueProposition: parsed.data,
          source: 'onboarding',
        },
        confidence: 85,
      })
    } catch (memoryErr) {
      console.error('[finishOnboardingSetup] ai_memory upsert failed', memoryErr)
    }

    return err('Complete all setup steps in the onboarding wizard before accessing the platform.')
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to complete onboarding')
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
    icp_description: null,
    icp_summary: null,
    value_proposition: null,
    website_url: null,
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
      return {
        success: true,
        data: {
          voicePreference: null,
          businessHoursStart: null,
          businessHoursEnd: null,
          bookingLink: null,
          reviewLink: null,
          paymentLink: null,
          emergencyLine: null,
        },
      }
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
    const { accountId: workspaceId } = await assertOwnAccount()

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

    return { success: true, data: { saved: true, rePersonalized: false } }
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

// Core apply logic — only invoked from Step 4 "Apply and continue".
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

  const { error: deleteAutomationsError } = await admin
    .from('automations')
    .delete()
    .eq('account_id', accountId)

  if (deleteAutomationsError) {
    throw new Error(deleteAutomationsError.message)
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
    const branding = getBrandingFromHeaders(headers())
    const accountName = account?.name || branding.businessName || 'Your workspace'

    const supabase = getSupabaseAdmin()
    const resend = new Resend(requireEnv('RESEND_API_KEY'))
    const fromAddress = `${accountName} <onboarding@${env.NEXT_PUBLIC_APP_DOMAIN}>`

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
          <h1 style="font-size:20px;margin:0 0 16px">You've been invited to join ${accountName}</h1>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 24px">
            ${accountName} has invited you as a <strong>${member.role}</strong>.
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
        subject: `You've been invited to join ${accountName}`,
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
    const { accountId: workspaceId } = await assertOwnAccount()

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

    const { encryptCredentialValue } = await import('@/lib/integrations/credential-secrets')
    const storedAccessToken = encryptCredentialValue(accessToken)

    await db
      .insert(integrationCredentials)
      .values({
        accountId: workspaceId,
        provider: providerKey,
        accessToken: storedAccessToken,
        metadata,
        isNativeMode: false,
      })
      .onConflictDoUpdate({
        target: [integrationCredentials.accountId, integrationCredentials.provider],
        set: {
          accessToken: storedAccessToken,
          metadata,
          isNativeMode: false,
          updatedAt: new Date(),
        },
      })

    return { success: true, data: { saved: true, rePersonalized: false } }
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

    return err('Complete all setup steps in the onboarding wizard before accessing the platform.')
  } catch (error) {
    rethrowFrameworkSignals(error)
    return err(error instanceof Error ? error.message : 'Failed to complete onboarding')
  }
}
