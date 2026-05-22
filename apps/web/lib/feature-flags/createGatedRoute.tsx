import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { FlagName, Plan } from '@/lib/feature-flags/flags'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export function createGatedRoute(flagName: FlagName) {
  return async function GatedRoute({ children }: { children: ReactNode }) {
    const session = await requireAdminSession()
    const branding = getBrandingFromHeaders(headers())
    const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan

    const enabled = await evaluateFlag({
      accountId: session.accountId,
      plan,
      flagName,
    })

    if (!enabled) {
      notFound()
    }

    return children
  }
}
