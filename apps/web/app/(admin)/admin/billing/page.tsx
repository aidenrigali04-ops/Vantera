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
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>}>
      <SubscriptionBillingClient
        currentPlan={row.plan}
        hasStripeCustomer={Boolean(row.stripeCustomerId)}
      />
    </Suspense>
  )
}
