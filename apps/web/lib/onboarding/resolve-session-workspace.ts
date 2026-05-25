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

type UserRow = {
  id: string
  account_id: string
  email: string
  role: AdminSession['role']
}

const USER_SELECT = 'id, account_id, email, role'

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAccountWithRetry(accountId: string): Promise<AccountRow | null> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return null

  for (let attempt = 0; attempt < 3; attempt++) {
    const account = await fetchAccountById(normalizedId)
    if (account) return account
    if (attempt < 2) await sleep(200)
  }

  return null
}

/**
 * Resolve the live users row for an admin session. Prefer session.userId,
 * then fall back to account + email (post-signup cookie races), then owner
 * on the session account.
 */
async function findUserForSession(session: AdminSession): Promise<UserRow | null> {
  const admin = getSupabaseAdmin()

  const { data: byId, error: byIdError } = await admin
    .from('users')
    .select(USER_SELECT)
    .eq('id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (byIdError) {
    throw new Error(byIdError.message)
  }

  if (byId) {
    return byId as UserRow
  }

  const normalizedEmail = normalizeEmail(session.email)
  const accountId = String(session.accountId).trim()

  if (accountId && normalizedEmail) {
    const { data: byEmail, error: byEmailError } = await admin
      .from('users')
      .select(USER_SELECT)
      .eq('account_id', accountId)
      .eq('email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle()

    if (byEmailError) {
      throw new Error(byEmailError.message)
    }

    if (byEmail) {
      return byEmail as UserRow
    }
  }

  if (accountId && session.role === 'owner') {
    const { data: byOwner, error: byOwnerError } = await admin
      .from('users')
      .select(USER_SELECT)
      .eq('account_id', accountId)
      .eq('role', 'owner')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byOwnerError) {
      throw new Error(byOwnerError.message)
    }

    if (byOwner) {
      return byOwner as UserRow
    }
  }

  return null
}

/**
 * Bind the admin JWT to a live users + accounts row. Refreshes the session
 * cookie when the DB is the source of truth (common after account wipes or
 * orphan cleanup while a browser tab still holds an old v_admin_session).
 *
 * Pass `refreshSession: false` from Server Components — cookies cannot be
 * mutated during RSC render; server actions will refresh on the next mutation.
 */
export async function resolveSessionWorkspace(
  session: AdminSession,
  options?: { refreshSession?: boolean },
): Promise<ResolvedWorkspace> {
  const userRow = await findUserForSession(session)

  if (!userRow) {
    throw new Error('Your session expired. Sign out, then sign in or create a new account.')
  }

  let sessionRefreshed = false
  let activeSession = session

  const sessionEmail = normalizeEmail(session.email)
  const userEmail = normalizeEmail(userRow.email)

  if (
    String(userRow.account_id) !== String(session.accountId) ||
    userEmail !== sessionEmail ||
    userRow.role !== session.role ||
    userRow.id !== session.userId
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

  const account = await fetchAccountWithRetry(userRow.account_id)
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
