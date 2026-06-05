import { db } from '@/lib/db/client'
import {
  generateLinkedInExtensionToken,
  hashLinkedInExtensionToken,
} from '@/lib/extension/linkedin/token'
import { linkedinAccounts } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export async function ensureLinkedinAccount(accountId: string, userId: string) {
  const existing = await db
    .select()
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.userId, userId)))
    .limit(1)

  if (existing[0]) return existing[0]

  const [created] = await db
    .insert(linkedinAccounts)
    .values({ accountId, userId })
    .returning()

  return created!
}

export async function issueLinkedInExtensionToken(
  accountId: string,
  userId: string,
): Promise<{ token: string; prefix: string; linkedinAccountId: string }> {
  const row = await ensureLinkedinAccount(accountId, userId)
  const { token, prefix, hash } = generateLinkedInExtensionToken()

  await db
    .update(linkedinAccounts)
    .set({
      extensionTokenHash: hash,
      extensionTokenPrefix: prefix,
      extensionTokenRevokedAt: null,
      extensionConnected: false,
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, row.id))

  return { token, prefix, linkedinAccountId: row.id }
}

export async function revokeLinkedInExtensionToken(accountId: string, userId: string) {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.userId, userId)))
    .limit(1)

  if (!row) return { ok: false as const, reason: 'not_found' }

  await db
    .update(linkedinAccounts)
    .set({
      extensionTokenHash: null,
      extensionTokenPrefix: null,
      extensionConnected: false,
      extensionTokenRevokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, row.id))

  return { ok: true as const }
}

export type LinkedInExtensionSession = {
  linkedinAccountId: string
  accountId: string
  userId: string
  dailyLimit: number
  dailySent: number
}

export async function resolveLinkedInExtensionSession(
  bearerToken: string | null,
): Promise<LinkedInExtensionSession | null> {
  if (!bearerToken || !bearerToken.startsWith('vnt_li_')) return null

  const hash = hashLinkedInExtensionToken(bearerToken)

  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.extensionTokenHash, hash))
    .limit(1)

  if (!row?.userId) return null
  if (row.extensionTokenRevokedAt) return null
  if (!row.extensionTokenHash) return null

  return {
    linkedinAccountId: row.id,
    accountId: row.accountId,
    userId: row.userId,
    dailyLimit: row.dailyLimit,
    dailySent: row.dailySent,
  }
}

export async function recordExtensionHeartbeat(linkedinAccountId: string) {
  await db
    .update(linkedinAccounts)
    .set({
      extensionConnected: true,
      extensionLastSeenAt: new Date(),
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, linkedinAccountId))
}

export async function incrementExtensionDailySent(linkedinAccountId: string) {
  const [row] = await db
    .select({ dailySent: linkedinAccounts.dailySent, dailyLimit: linkedinAccounts.dailyLimit })
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.id, linkedinAccountId))
    .limit(1)

  if (!row) return { allowed: false, dailySent: 0, dailyLimit: 0 }

  if (row.dailySent >= row.dailyLimit) {
    return { allowed: false, dailySent: row.dailySent, dailyLimit: row.dailyLimit }
  }

  await db
    .update(linkedinAccounts)
    .set({
      dailySent: row.dailySent + 1,
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, linkedinAccountId))

  return { allowed: true, dailySent: row.dailySent + 1, dailyLimit: row.dailyLimit }
}
