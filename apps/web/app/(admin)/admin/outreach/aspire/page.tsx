import { AspirePageClient } from '@/app/(admin)/admin/outreach/aspire/AspirePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findSavedSearches } from '@/lib/aspire/queries'
import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function AspirePage() {
  const session = await requireAdminSession()
  const [savedSearches, [account]] = await Promise.all([
    findSavedSearches(session.accountId),
    db
      .select({ vertical: accounts.vertical })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
  ])

  return (
    <AspirePageClient
      savedSearches={savedSearches}
      accountId={session.accountId}
      accountVertical={account?.vertical ?? 'agency'}
    />
  )
}
