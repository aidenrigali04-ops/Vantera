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

const ACCOUNT_SELECT_PIPELINE =
  'id,slug,name,vertical,plan,active_template_id,onboarding_completed_at'

const ACCOUNT_SELECT_ID = 'id'

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    (lower.includes('column') &&
      (lower.includes('does not exist') || lower.includes('could not find'))) ||
    lower.includes('unknown field') ||
    (lower.includes('bad request') && lower.includes('column'))
  )
}

function emptyAccountRow(id: string): AccountRow {
  return {
    id,
    slug: '',
    name: '',
    vertical: 'agency',
    plan: 'team',
    brand_logo_url: null,
    brand_primary_color: null,
    brand_secondary_color: null,
    portal_domain: null,
    timezone: null,
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

function normalizeAccountRow(row: Partial<AccountRow> & Pick<AccountRow, 'id'>): AccountRow {
  return {
    ...emptyAccountRow(row.id),
    ...row,
    brand_logo_url: row.brand_logo_url ?? null,
    brand_primary_color: row.brand_primary_color ?? null,
    brand_secondary_color: row.brand_secondary_color ?? null,
    portal_domain: row.portal_domain ?? null,
    timezone: row.timezone ?? null,
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

async function fetchAccountViaSupabase(
  normalizedId: string,
  select: string,
): Promise<AccountRow | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('accounts')
    .select(select.replace(/,/g, ', '))
    .eq('id', normalizedId)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error.message)) {
      return null
    }
    throw new Error(error.message)
  }

  return data ? normalizeAccountRow(data as unknown as AccountRow) : null
}

/** True if the account row exists (id-only probe). */
export async function accountExists(accountId: string): Promise<boolean> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return false

  const rest = await fetchAccountByIdRest(normalizedId, ACCOUNT_SELECT_ID)
  if (rest.data?.id) return true
  if (rest.error) {
    console.error('[accountExists] REST failed', rest.error)
  }

  try {
    const row = await fetchAccountViaSupabase(normalizedId, ACCOUNT_SELECT_ID)
    return Boolean(row?.id)
  } catch (err) {
    console.error('[accountExists] supabase-js failed', err)
    return false
  }
}

/**
 * Patch an account row via PostgREST (preferred) with supabase-js fallback.
 * Does not pre-fetch — PATCH + return=representation confirms the row exists.
 */
export async function patchAccountRow(
  accountId: string,
  patch: Record<string, string | number | boolean | null>,
): Promise<PatchResult> {
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return { ok: false, message: 'Invalid workspace id' }
  }

  const body = {
    ...patch,
    updated_at: new Date().toISOString(),
  }

  const rest = await supabaseServiceRest<AccountRow[]>('accounts', {
    method: 'PATCH',
    query: { id: `eq.${normalizedId}` },
    body,
    prefer: 'return=representation',
  })

  if (!rest.error && Array.isArray(rest.data) && rest.data.length > 0) {
    return { ok: true }
  }

  if (rest.error) {
    console.error('[patchAccountRow] REST PATCH failed', rest.error)
  }

  const minimalPatch = await supabaseServiceRest<null>('accounts', {
    method: 'PATCH',
    query: { id: `eq.${normalizedId}` },
    body,
  })

  if (!minimalPatch.error) {
    return { ok: true }
  }

  console.error('[patchAccountRow] REST PATCH (minimal) failed', minimalPatch.error)

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('accounts')
      .update(body)
      .eq('id', normalizedId)
      .select('id')
      .maybeSingle()

    if (!error && data) {
      return { ok: true }
    }

    if (error) {
      return { ok: false, message: error.message }
    }
  } catch (err) {
    console.error('[patchAccountRow] supabase-js fallback failed', err)
  }

  return {
    ok: false,
    message: 'Could not save workspace settings. Refresh and try again.',
  }
}

/** Load a tenant account by id — PostgREST first, then supabase-js, with select fallbacks. */
export async function fetchAccountById(accountId: string): Promise<AccountRow | null> {
  const normalizedId = String(accountId).trim()

  if (!normalizedId) {
    return null
  }

  const attempts: string[] = [
    ACCOUNT_SELECT,
    ACCOUNT_SELECT_MINIMAL,
    ACCOUNT_SELECT_PIPELINE,
    ACCOUNT_SELECT_ID,
  ]

  for (const select of attempts) {
    const rest = await fetchAccountByIdRest(normalizedId, select)
    if (rest.data) {
      return normalizeAccountRow(rest.data)
    }
    if (rest.error) {
      console.error('[fetchAccountById] REST select failed', select, rest.error)
    }
  }

  for (const select of attempts) {
    try {
      const row = await fetchAccountViaSupabase(normalizedId, select)
      if (row) {
        return row
      }
    } catch (err) {
      console.error('[fetchAccountById] supabase-js select failed', select, err)
      if (err instanceof Error && !isMissingColumnError(err.message)) {
        throw err
      }
    }
  }

  return null
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

  console.error('[accountHasStageDefinitions] REST failed', rest.error)

  try {
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
  } catch (err) {
    console.error('[accountHasStageDefinitions] supabase-js failed', err)
    return false
  }
}

export async function markOnboardingComplete(accountId: string): Promise<PatchResult> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) {
    return { ok: false, message: 'Invalid workspace id' }
  }

  const timestamp = new Date().toISOString()
  const body = {
    onboarding_completed_at: timestamp,
    updated_at: timestamp,
  }

  const withRepresentation = await supabaseServiceRest<AccountRow[]>('accounts', {
    method: 'PATCH',
    query: { id: `eq.${normalizedId}` },
    body,
    prefer: 'return=representation',
  })

  if (!withRepresentation.error && Array.isArray(withRepresentation.data) && withRepresentation.data.length > 0) {
    return { ok: true }
  }

  if (withRepresentation.error) {
    console.error('[markOnboardingComplete] REST PATCH (representation) failed', withRepresentation.error)
  }

  const minimalPatch = await supabaseServiceRest<null>('accounts', {
    method: 'PATCH',
    query: { id: `eq.${normalizedId}` },
    body,
  })

  if (!minimalPatch.error) {
    const verify = await supabaseServiceRestSingle<{ onboarding_completed_at: string | null }>('accounts', {
      select: 'onboarding_completed_at',
      id: `eq.${normalizedId}`,
    })

    if (verify.data?.onboarding_completed_at) {
      return { ok: true }
    }
  } else {
    console.error('[markOnboardingComplete] REST PATCH (minimal) failed', minimalPatch.error)
  }

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('accounts')
      .update(body)
      .eq('id', normalizedId)
      .select('onboarding_completed_at')
      .maybeSingle()

    if (!error && data?.onboarding_completed_at) {
      return { ok: true }
    }

    if (error) {
      return { ok: false, message: error.message }
    }
  } catch (err) {
    console.error('[markOnboardingComplete] supabase-js failed', err)
  }

  return {
    ok: false,
    message: 'Could not finalize your workspace. Refresh and try again.',
  }
}
