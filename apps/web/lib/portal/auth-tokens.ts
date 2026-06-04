import { db } from '@/lib/db/client'
import { derivePortalActivateUrl } from '@/lib/portal/url'
import { accounts, contacts, portalInviteTokens } from '@vantera/db'
import { createHash, randomBytes } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'

export const PORTAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hashPortalInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function generatePortalInviteRawToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function createPortalInviteLink(input: {
  contactId: string
  accountId: string
  portalBaseUrl: string
}): Promise<{ rawToken: string; activateUrl: string } | null> {
  const rawToken = generatePortalInviteRawToken()
  const tokenHash = hashPortalInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + PORTAL_INVITE_TTL_MS)

  await db
    .delete(portalInviteTokens)
    .where(
      and(
        eq(portalInviteTokens.contactId, input.contactId),
        isNull(portalInviteTokens.usedAt),
      ),
    )

  await db.insert(portalInviteTokens).values({
    contactId: input.contactId,
    accountId: input.accountId,
    tokenHash,
    expiresAt,
  })

  const activateUrl = derivePortalActivateUrl(input.portalBaseUrl, rawToken)
  return { rawToken, activateUrl }
}

export type PortalInviteTokenRow = typeof portalInviteTokens.$inferSelect

export async function findValidPortalInviteToken(
  rawToken: string,
): Promise<
  | (PortalInviteTokenRow & {
      contact: typeof contacts.$inferSelect
      account: Pick<typeof accounts.$inferSelect, 'id' | 'name' | 'slug'>
    })
  | null
> {
  const trimmed = rawToken.trim()
  if (!trimmed) return null

  const tokenHash = hashPortalInviteToken(trimmed)
  const [row] = await db
    .select()
    .from(portalInviteTokens)
    .where(eq(portalInviteTokens.tokenHash, tokenHash))
    .limit(1)

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null
  }

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, row.contactId),
        eq(contacts.accountId, row.accountId),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  if (!contact?.portalAccess) {
    return null
  }

  const [account] = await db
    .select({ id: accounts.id, name: accounts.name, slug: accounts.slug })
    .from(accounts)
    .where(eq(accounts.id, row.accountId))
    .limit(1)

  if (!account) {
    return null
  }

  return { ...row, contact, account }
}

export async function markPortalInviteTokenUsed(tokenId: string): Promise<void> {
  await db
    .update(portalInviteTokens)
    .set({ usedAt: new Date() })
    .where(eq(portalInviteTokens.id, tokenId))
}

export async function revokePortalInviteTokens(contactId: string): Promise<void> {
  await db.delete(portalInviteTokens).where(eq(portalInviteTokens.contactId, contactId))
}
