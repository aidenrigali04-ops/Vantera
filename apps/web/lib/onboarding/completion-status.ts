import { db } from '@/lib/db/client'
import { isAccountOnboardingCompleteViaSql } from '@/lib/db/direct-sql'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServiceRestSingle } from '@/lib/supabase/service-rest'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

/**
 * Source of truth for whether an account finished onboarding.
 * Tries direct SQL first (reliable on Vercel), then Drizzle / PostgREST.
 */
export async function isOnboardingCompleteForAccount(accountId: string): Promise<boolean> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return false

  try {
    const sqlResult = await isAccountOnboardingCompleteViaSql(normalizedId)
    if (sqlResult !== null) {
      return sqlResult
    }
  } catch (err) {
    console.error('[isOnboardingCompleteForAccount] direct SQL failed', err)
  }

  try {
    const [row] = await db
      .select({ onboardingCompletedAt: accounts.onboardingCompletedAt })
      .from(accounts)
      .where(eq(accounts.id, normalizedId))
      .limit(1)

    if (row) {
      return Boolean(row.onboardingCompletedAt)
    }
  } catch (err) {
    console.error('[isOnboardingCompleteForAccount] Drizzle failed', err)
  }

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
