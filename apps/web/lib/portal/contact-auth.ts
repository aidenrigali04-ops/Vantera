import { db } from '@/lib/db/client'
import { contacts } from '@vantera/db'
import { and, eq, isNull, isNotNull } from 'drizzle-orm'

export type PortalAuthContact = {
  id: string
  email: string | null
  accountId: string
  portalAccess: boolean
  portalPasswordHash: string | null
}

export async function findPortalContactForLogin(
  accountId: string,
  email: string,
): Promise<PortalAuthContact | null> {
  const normalized = email.toLowerCase().trim()

  const [row] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      accountId: contacts.accountId,
      portalAccess: contacts.portalAccess,
      portalPasswordHash: contacts.portalPasswordHash,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.email, normalized),
        eq(contacts.portalAccess, true),
        isNotNull(contacts.portalPasswordHash),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  return row ?? null
}
