import { EmailOutreachPageClient } from '@/components/outreach/EmailOutreachPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getEmailOutreachHubSnapshot, getEmailPageDomainSettings } from '@/lib/outreach/email-hub'

export const dynamic = 'force-dynamic'

export default async function EmailOutreachPage() {
  const session = await requireAdminSession()

  const [hub, domainSettings] = await Promise.all([
    getEmailOutreachHubSnapshot(session.accountId),
    getEmailPageDomainSettings(),
  ])

  if (!domainSettings) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Could not load email domain settings
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          Refresh the page or contact support if this persists.
        </p>
      </div>
    )
  }

  return <EmailOutreachPageClient initialHub={hub} domainSettings={domainSettings} />
}
