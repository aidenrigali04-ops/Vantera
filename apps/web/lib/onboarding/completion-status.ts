import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServiceRestSingle } from '@/lib/supabase/service-rest'

/**
 * Source of truth for whether an account finished onboarding.
 * Uses PostgREST (same transport as signup) — never Drizzle / DATABASE_URL.
 */
export async function isOnboardingCompleteForAccount(accountId: string): Promise<boolean> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return false

  const rest = await supabaseServiceRestSingle<{ onboarding_completed_at: string | null }>(
    'accounts',
    {
      select: 'onboarding_completed_at',
      id: `eq.${normalizedId}`,
    },
  )

  if (!rest.error && rest.data) {
    return Boolean(rest.data.onboarding_completed_at)
  }

  if (rest.error) {
    console.error('[isOnboardingCompleteForAccount] REST failed', rest.error)
  }

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('accounts')
      .select('onboarding_completed_at')
      .eq('id', normalizedId)
      .maybeSingle()

    if (error) {
      console.error('[isOnboardingCompleteForAccount] supabase-js failed', error.message)
      return false
    }

    return Boolean(data?.onboarding_completed_at)
  } catch (err) {
    console.error('[isOnboardingCompleteForAccount] supabase-js threw', err)
    return false
  }
}
