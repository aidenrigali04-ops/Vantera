import { AspirePageClient } from '@/app/(admin)/admin/outreach/aspire/AspirePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findSavedSearches } from '@/lib/aspire/queries'

export const dynamic = 'force-dynamic'

export default async function AspirePage() {
  const session = await requireAdminSession()
  const savedSearches = await findSavedSearches(session.accountId)

  return <AspirePageClient savedSearches={savedSearches} accountId={session.accountId} />
}
