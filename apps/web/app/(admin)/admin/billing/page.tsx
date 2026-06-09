import { SubscriptionBillingClient } from '@/components/billing/SubscriptionBillingClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const session = await requireAdminSession()

  const [account] = await db
    .select({
      plan: accounts.plan,
      stripeCustomerId: accounts.stripeCustomerId,
    })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const row = account ?? { plan: 'team', stripeCustomerId: null }

  return (
    <Suspense fallback={
      <div className="space-y-4 p-6">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-[var(--bg-overlay)]" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-[var(--bg-overlay)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-overlay)]" />
      </div>
    }>
      <SubscriptionBillingClient
        currentPlan={row.plan}
        hasStripeCustomer={Boolean(row.stripeCustomerId)}
      />
    </Suspense>
  )
}
