import { OptimizationDashboard } from '@/components/admin/optimization/OptimizationDashboard'
import { requireAdminSession } from '@/lib/auth/require-session'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Owner-only optimization dashboard. Gated to the super-admin allowlist
 * (session email) — returns 404 for everyone else so the route's existence
 * is not revealed. No separate password: identity is the authenticated session.
 */
export default async function OptimizationPage() {
  const session = await requireAdminSession()

  if (!isSuperAdmin(session.email)) {
    notFound()
  }

  return <OptimizationDashboard />
}
