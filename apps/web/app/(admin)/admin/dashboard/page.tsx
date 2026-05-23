import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getDashboardSnapshot } from '@/lib/sample-data/queries'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  // Belt-and-suspenders: middleware already gates /admin/* for un-onboarded
  // owners, but if the matcher ever changes or the cached headers are stale,
  // we'd rather force them through the wizard than render an empty dashboard.
  if (session.role === 'owner' && !branding.onboardingComplete) {
    redirect('/admin/onboarding')
  }

  const snapshot = await getDashboardSnapshot(session.accountId)

  return (
    <DashboardClient
      email={session.email}
      role={session.role}
      businessName={branding.businessName || 'Your workspace'}
      primaryColor={branding.primaryColor || '#1648A0'}
      snapshot={snapshot}
    />
  )
}
