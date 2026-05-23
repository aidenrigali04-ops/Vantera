import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getDashboardSnapshot } from '@/lib/sample-data/queries'
import { headers } from 'next/headers'
import { DashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())
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
