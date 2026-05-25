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

  const { data, error } = await admin
    .from('accounts')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }

  if (!data) {
    return { ok: false, message: 'Account not found' }
  }

  return { ok: true }
}

/** Load a tenant account by id through the service-role client. */
export async function fetchAccountById(accountId: string): Promise<AccountRow | null> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('id', accountId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as AccountRow | null) ?? null
}

export async function accountHasStageDefinitions(accountId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('stage_definitions')
    .select('id')
    .eq('account_id', accountId)
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
