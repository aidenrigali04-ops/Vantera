import type { AdminSession } from '@/lib/auth/types'
import { setAdminSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AccountRow } from './account-store'
import { fetchAccountById } from './account-store'

export type ResolvedWorkspace = {
  accountId: string
  account: AccountRow
  session: AdminSession
  sessionRefreshed: boolean
}

/**
 * Bind the admin JWT to a live users + accounts row. Refreshes the session
 * cookie when the DB is the source of truth (common after account wipes or
 * orphan cleanup while a browser tab still holds an old v_admin_session).
 */
export async function resolveSessionWorkspace(
  session: AdminSession,
  options?: { refreshSession?: boolean },
): Promise<ResolvedWorkspace> {
  const admin = getSupabaseAdmin()

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('id, account_id, email, role')
    .eq('id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!userRow) {
    throw new Error('Your session expired. Sign out, then sign in or create a new account.')
  }

  let sessionRefreshed = false
  let activeSession = session

  if (
    String(userRow.account_id) !== String(session.accountId) ||
    userRow.email !== session.email ||
    userRow.role !== session.role
  ) {
    activeSession = {
      type: 'admin',
      userId: userRow.id,
      accountId: userRow.account_id,
      role: userRow.role as AdminSession['role'],
      email: userRow.email,
    }
    if (options?.refreshSession !== false) {
      await setAdminSession(activeSession)
    }
    sessionRefreshed = true
  }

  const account = await fetchAccountById(userRow.account_id)
  if (!account) {
    throw new Error(
      'Your workspace could not be found. Sign out and sign up again, or contact support if this keeps happening.',
    )
  }

  return {
    accountId: userRow.account_id,
    account,
    session: activeSession,
    sessionRefreshed,
  }
}

export async function resolveCanonicalAccountId(session: AdminSession): Promise<string> {
  const { accountId } = await resolveSessionWorkspace(session)
  return accountId
}
