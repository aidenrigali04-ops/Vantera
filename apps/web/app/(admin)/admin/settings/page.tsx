import { SettingsPageClient } from '@/app/(admin)/admin/settings/SettingsPageClient'
import { OutreachDomainSettingsPanel } from '@/components/settings/OutreachDomainSettings'
import { requireAdminSession } from '@/lib/auth/require-session'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { findUsersForAccount } from '@/lib/db/queries'
import { getOutreachDomainSettings } from '@/lib/settings/outreach-domain-actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await requireAdminSession()
  const account = await fetchAccountById(session.accountId)
  const team = await findUsersForAccount(session.accountId)
  const outreachDomain = await getOutreachDomainSettings()

  return (
    <div className="space-y-6">
      <SettingsPageClient
        accountId={session.accountId}
        sessionEmail={session.email}
        sessionRole={session.role}
        account={{
          name: account?.name ?? '',
          vertical: account?.vertical ?? 'agency',
          plan: account?.plan ?? 'team',
          timezone: account?.timezone ?? '',
          logoUrl: account?.brand_logo_url ?? null,
          primaryColor: account?.brand_primary_color ?? '#1648A0',
          secondaryColor: account?.brand_secondary_color ?? '#0D9488',
        }}
        team={team.map((member) => ({
          id: member.id,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
        }))}
      />
      {outreachDomain.success && outreachDomain.data ? (
        <OutreachDomainSettingsPanel initial={outreachDomain.data} />
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">Outreach email domain settings could not be loaded</p>
          <p className="mt-1 text-[13px]">
            {!outreachDomain.success
              ? outreachDomain.error
              : 'Refresh the page or contact support if this persists.'}
          </p>
        </section>
      )}
    </div>
  )
}
