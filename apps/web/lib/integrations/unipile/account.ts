import { db } from '@/lib/db/client'
import { linkedinAccounts } from '@vantera/db'
import { and, eq, isNotNull } from 'drizzle-orm'
import { deleteUnipileAccount, getUnipileAccount } from './client'

/** Return the connected Unipile account row for a user, or null. */
export async function findUnipileLinkedInAccount(accountId: string, userId: string) {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(
      and(
        eq(linkedinAccounts.accountId, accountId),
        eq(linkedinAccounts.userId, userId),
        isNotNull(linkedinAccounts.unipileAccountId),
      ),
    )
    .limit(1)

  return row ?? null
}

/**
 * Find the first connected Unipile LinkedIn account for an account.
 * Used by the outreach runner which doesn't know which user's LinkedIn to use —
 * it picks the owner's (first connected).
 */
export async function findFirstUnipileAccountForWorkspace(accountId: string) {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(
      and(
        eq(linkedinAccounts.accountId, accountId),
        eq(linkedinAccounts.unipileConnected, true),
        isNotNull(linkedinAccounts.unipileAccountId),
      ),
    )
    .limit(1)

  return row ?? null
}

/** Persist a connected Unipile account ID after the hosted auth completes. */
export async function saveUnipileConnection(
  accountId: string,
  userId: string,
  unipileAccountId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: linkedinAccounts.id })
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.userId, userId)))
    .limit(1)

  if (existing) {
    await db
      .update(linkedinAccounts)
      .set({
        unipileAccountId,
        unipileConnected: true,
        unipileConnectedAt: new Date(),
        unipileLastError: null,
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.id, existing.id))
  } else {
    await db.insert(linkedinAccounts).values({
      accountId,
      userId,
      unipileAccountId,
      unipileConnected: true,
      unipileConnectedAt: new Date(),
    })
  }
}

/** Mark a Unipile account as disconnected in Vantera DB and optionally remove from Unipile. */
export async function disconnectUnipileAccount(
  accountId: string,
  userId: string,
  { deleteFromUnipile = false } = {},
): Promise<{ ok: boolean }> {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.userId, userId)))
    .limit(1)

  if (!row) return { ok: false }

  if (deleteFromUnipile && row.unipileAccountId) {
    await deleteUnipileAccount(row.unipileAccountId).catch(() => {})
  }

  await db
    .update(linkedinAccounts)
    .set({
      unipileAccountId: null,
      unipileConnected: false,
      unipileConnectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, row.id))

  return { ok: true }
}

/** Sync live status from Unipile and update our DB. Returns current connection health. */
export async function refreshUnipileConnectionStatus(
  accountId: string,
  userId: string,
): Promise<{ connected: boolean; status: string }> {
  const row = await findUnipileLinkedInAccount(accountId, userId)
  if (!row?.unipileAccountId) return { connected: false, status: 'not_configured' }

  try {
    const account = await getUnipileAccount(row.unipileAccountId)
    const connected = account.connection_status === 'OK'

    await db
      .update(linkedinAccounts)
      .set({
        unipileConnected: connected,
        unipileLastError: connected ? null : account.connection_status,
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.id, row.id))

    return { connected, status: account.connection_status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    await db
      .update(linkedinAccounts)
      .set({ unipileConnected: false, unipileLastError: msg, updatedAt: new Date() })
      .where(eq(linkedinAccounts.id, row.id))

    return { connected: false, status: 'error' }
  }
}
