import { SettingsPageClient } from '@/app/(admin)/admin/settings/SettingsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { findUsersForAccount } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await requireAdminSession()
  const account = await fetchAccountById(session.accountId)
  const team = await findUsersForAccount(session.accountId)

  return (
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
        portalDomain: account?.portal_domain ?? '',
      }}
      team={team.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
      }))}
    />
  )
}
