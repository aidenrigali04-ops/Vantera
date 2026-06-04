import { LinkedInOutreachPageClient } from '@/components/outreach/LinkedInOutreachPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getLinkedInOutreachHubSnapshot } from '@/lib/outreach/linkedin-hub'

export const dynamic = 'force-dynamic'

export default async function LinkedInOutreachPage() {
  const session = await requireAdminSession()
  const hub = await getLinkedInOutreachHubSnapshot(session.accountId, session.userId)

  return <LinkedInOutreachPageClient initialHub={hub} />
}
