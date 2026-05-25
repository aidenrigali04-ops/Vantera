import { getSupabaseAdmin } from '@/lib/supabase/admin'

type PatchResult = { ok: true } | { ok: false; message: string }

export type AccountRow = {
  id: string
  slug: string
  name: string
  vertical: string
  plan: string
  brand_logo_url: string | null
  brand_primary_color: string | null
  brand_secondary_color: string | null
  portal_domain: string | null
  timezone: string | null
  booking_link: string | null
  review_link: string | null
  payment_link: string | null
  emergency_line: string | null
  business_hours_start: number | null
  business_hours_end: number | null
  voice_preference: string | null
  active_template_id: string | null
  onboarding_completed_at: string | null
}

const ACCOUNT_SELECT =
  'id, slug, name, vertical, plan, brand_logo_url, brand_primary_color, brand_secondary_color, portal_domain, timezone, booking_link, review_link, payment_link, emergency_line, business_hours_start, business_hours_end, voice_preference, active_template_id, onboarding_completed_at'

const ACCOUNT_SELECT_MINIMAL =
  'id, slug, name, vertical, plan, brand_logo_url, brand_primary_color, brand_secondary_color, portal_domain, timezone, onboarding_completed_at'

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('column') && (lower.includes('does not exist') || lower.includes('could not find'))
}

/**
 * Patch an account row via the Supabase service-role client — the same
 * transport signup uses. Avoids relying on DATABASE_URL / Drizzle in
 * Server Actions where the pooler URL may be missing or misconfigured on
 * Vercel even when SUPABASE_SERVICE_ROLE_KEY works.
 */
export async function patchAccountRow(
  accountId: string,
  patch: Record<string, string | number | boolean | null>,
): Promise<PatchResult> {
  const admin = getSupabaseAdmin()
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return { ok: false, message: 'Invalid workspace id' }
  }

  const existing = await fetchAccountById(normalizedId)
  if (!existing) {
    return { ok: false, message: 'Account not found' }
  }

  const { error } = await admin
    .from('accounts')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

/** Load a tenant account by id through the service-role client. */
export async function fetchAccountById(accountId: string): Promise<AccountRow | null> {
  const admin = getSupabaseAdmin()
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return null
  }

  const { data, error } = await admin
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('id', normalizedId)
    .maybeSingle()

  if (!error) {
    return (data as AccountRow | null) ?? null
  }

  if (isMissingColumnError(error.message)) {
    const { data: minimal, error: minimalError } = await admin
      .from('accounts')
      .select(ACCOUNT_SELECT_MINIMAL)
      .eq('id', normalizedId)
      .maybeSingle()

    if (minimalError) {
      throw new Error(minimalError.message)
    }

    if (!minimal) return null

    return {
      ...(minimal as AccountRow),
      booking_link: null,
      review_link: null,
      payment_link: null,
      emergency_line: null,
      business_hours_start: null,
      business_hours_end: null,
      voice_preference: null,
      active_template_id: null,
    }
  }

  throw new Error(error.message)
}

export async function accountHasStageDefinitions(accountId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const normalizedId = String(accountId).trim()

  const { data, error } = await admin
    .from('stage_definitions')
    .select('id')
    .eq('account_id', normalizedId)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return (data?.length ?? 0) > 0
}

export async function markOnboardingComplete(accountId: string): Promise<PatchResult> {
  return patchAccountRow(accountId, {
    onboarding_completed_at: new Date().toISOString(),
  })
}
