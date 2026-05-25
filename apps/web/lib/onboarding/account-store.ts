import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServiceRest, supabaseServiceRestSingle } from '@/lib/supabase/service-rest'

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
  'id,slug,name,vertical,plan,brand_logo_url,brand_primary_color,brand_secondary_color,portal_domain,timezone,booking_link,review_link,payment_link,emergency_line,business_hours_start,business_hours_end,voice_preference,active_template_id,onboarding_completed_at'

const ACCOUNT_SELECT_MINIMAL =
  'id,slug,name,vertical,plan,brand_logo_url,brand_primary_color,brand_secondary_color,portal_domain,timezone,onboarding_completed_at'

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('column') && (lower.includes('does not exist') || lower.includes('could not find'))
}

function normalizeAccountRow(row: AccountRow): AccountRow {
  return {
    ...row,
    booking_link: row.booking_link ?? null,
    review_link: row.review_link ?? null,
    payment_link: row.payment_link ?? null,
    emergency_line: row.emergency_line ?? null,
    business_hours_start: row.business_hours_start ?? null,
    business_hours_end: row.business_hours_end ?? null,
    voice_preference: row.voice_preference ?? null,
    active_template_id: row.active_template_id ?? null,
    onboarding_completed_at: row.onboarding_completed_at ?? null,
  }
}

async function fetchAccountByIdRest(
  normalizedId: string,
  select: string,
): Promise<{ data: AccountRow | null; error: string | null }> {
  return supabaseServiceRestSingle<AccountRow>('accounts', {
    select,
    id: `eq.${normalizedId}`,
  })
}

/**
 * Patch an account row via PostgREST (preferred) with supabase-js fallback.
 */
export async function patchAccountRow(
  accountId: string,
  patch: Record<string, string | number | boolean | null>,
): Promise<PatchResult> {
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return { ok: false, message: 'Invalid workspace id' }
  }

  const existing = await fetchAccountById(normalizedId)
  if (!existing) {
    return { ok: false, message: 'Account not found' }
  }

  const body = {
    ...patch,
    updated_at: new Date().toISOString(),
  }

  const rest = await supabaseServiceRest<null>('accounts', {
    method: 'PATCH',
    query: { id: `eq.${normalizedId}` },
    body,
  })

  if (!rest.error) {
    return { ok: true }
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('accounts').update(body).eq('id', normalizedId)

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

/** Load a tenant account by id — PostgREST first, supabase-js fallback. */
export async function fetchAccountById(accountId: string): Promise<AccountRow | null> {
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return null
  }

  const full = await fetchAccountByIdRest(normalizedId, ACCOUNT_SELECT)
  if (!full.error && full.data) {
    return normalizeAccountRow(full.data)
  }

  if (full.error && !isMissingColumnError(full.error)) {
    console.error('[fetchAccountById] REST full select failed', full.error)
  }

  if (full.error && isMissingColumnError(full.error)) {
    const minimal = await fetchAccountByIdRest(normalizedId, ACCOUNT_SELECT_MINIMAL)
    if (minimal.error) {
      throw new Error(minimal.error)
    }
    if (!minimal.data) return null

    return normalizeAccountRow({
      ...(minimal.data as AccountRow),
      booking_link: null,
      review_link: null,
      payment_link: null,
      emergency_line: null,
      business_hours_start: null,
      business_hours_end: null,
      voice_preference: null,
      active_template_id: null,
    })
  }

  if (!full.error && !full.data) {
    return null
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('accounts')
    .select(ACCOUNT_SELECT.replace(/,/g, ', '))
    .eq('id', normalizedId)
    .maybeSingle()

  if (!error) {
    return (data as AccountRow | null) ?? null
  }

  if (isMissingColumnError(error.message)) {
    const { data: minimal, error: minimalError } = await admin
      .from('accounts')
      .select(ACCOUNT_SELECT_MINIMAL.replace(/,/g, ', '))
      .eq('id', normalizedId)
      .maybeSingle()

    if (minimalError) {
      throw new Error(minimalError.message)
    }

    if (!minimal) return null

    return normalizeAccountRow({
      ...(minimal as unknown as AccountRow),
      booking_link: null,
      review_link: null,
      payment_link: null,
      emergency_line: null,
      business_hours_start: null,
      business_hours_end: null,
      voice_preference: null,
      active_template_id: null,
    })
  }

  throw new Error(error.message)
}

export async function accountHasStageDefinitions(accountId: string): Promise<boolean> {
  const normalizedId = String(accountId).trim()

  const rest = await supabaseServiceRest<{ id: string }[]>('stage_definitions', {
    query: {
      select: 'id',
      account_id: `eq.${normalizedId}`,
      limit: '1',
    },
  })

  if (!rest.error) {
    return Array.isArray(rest.data) && rest.data.length > 0
  }

  const admin = getSupabaseAdmin()
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
