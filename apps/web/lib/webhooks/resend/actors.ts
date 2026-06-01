import { db } from '@/lib/db/client'
import { users } from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export async function resolveAccountOwnerId(accountId: string): Promise<string | null> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.accountId, accountId), eq(users.role, 'owner'), eq(users.isActive, true)))
    .limit(1)

  return owner?.id ?? null
}
