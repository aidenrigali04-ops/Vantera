import { SettingsPageClient } from '@/app/(admin)/admin/settings/SettingsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { getTeamOverview } from '@/lib/team/queries'
import type { AccountPlan } from '@/lib/team/seats'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await requireAdminSession()
  const account = await fetchAccountById(session.accountId)
  const plan = (account?.plan ?? 'team') as AccountPlan
  const teamOverview = await getTeamOverview(session.accountId, plan)

  return (
    <SettingsPageClient
      accountId={session.accountId}
      sessionEmail={session.email}
      sessionRole={session.role}
      sessionUserId={session.userId}
      account={{
        name: account?.name ?? '',
        vertical: account?.vertical ?? 'agency',
        plan,
        timezone: account?.timezone ?? '',
        logoUrl: account?.brand_logo_url ?? null,
        primaryColor: account?.brand_primary_color ?? '#1648A0',
        secondaryColor: account?.brand_secondary_color ?? '#0D9488',
      }}
      team={teamOverview.members}
      pendingInvites={teamOverview.pendingInvites}
      seatUsage={teamOverview.seatUsage}
    />
  )
}
