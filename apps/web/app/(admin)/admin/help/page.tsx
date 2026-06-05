import { HelpCenterPageClient } from '@/app/(admin)/admin/help/HelpCenterPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { headers } from 'next/headers'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function resolveAppOrigin(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
}

export default async function HelpCenterPage() {
  await requireAdminSession()
  const appOrigin = resolveAppOrigin()

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>}>
      <HelpCenterPageClient appOrigin={appOrigin} />
    </Suspense>
  )
}
