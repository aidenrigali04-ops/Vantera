import { requireAdminSession } from '@/lib/auth/require-session'
import { DashboardClient } from './dashboard-client'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()

  return <DashboardClient email={session.email} role={session.role} />
}
