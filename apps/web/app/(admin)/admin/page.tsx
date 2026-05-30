import { requireAdminSession } from '@/lib/auth/require-session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Bare /admin entry — always lands on the dashboard (explore-first onboarding). */
export default async function AdminRootPage() {
  await requireAdminSession()
  redirect('/admin/dashboard')
}
