import 'server-only'

import { db } from '@/lib/db/client'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { getSeatPriceId } from '@/lib/stripe/subscription-config'
import { getBillableSeatCount } from '@/lib/team/seats'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export type SeatSyncResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: SeatSyncSkip }

export type SeatSyncSkip =
  | 'stripe_not_configured'
  | 'seat_price_not_configured'
  | 'no_subscription'
  | 'account_not_found'
  | 'error'

/**
 * Push the account's billable seat count to its Stripe subscription. Our DB
 * (active members + pending invites) is the source of truth; this reconciles
 * the seat line item to match — creating, updating, or removing it, with
 * proration. Safe to call fire-and-forget after any seat change; never throws.
 *
 * No-ops cleanly for free/un-subscribed accounts (nothing to bill) and when the
 * seat price isn't configured yet, so it can ship before the Stripe price exists.
 */
export async function syncSeatQuantityForAccount(accountId: string): Promise<SeatSyncResult> {
  try {
    const stripe = getPlatformStripe()
    if (!stripe) return { ok: false, reason: 'stripe_not_configured' }

    const seatPriceId = getSeatPriceId()
    if (!seatPriceId) return { ok: false, reason: 'seat_price_not_configured' }

    const [account] = await db
      .select({
        plan: accounts.plan,
        stripeSubscriptionId: accounts.stripeSubscriptionId,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!account) return { ok: false, reason: 'account_not_found' }
    // Free / un-subscribed accounts have no subscription to bill seats against.
    if (!account.stripeSubscriptionId) return { ok: false, reason: 'no_subscription' }

    const plan = (account.plan ?? 'team') as 'team' | 'enterprise'
    const billableSeats = await getBillableSeatCount(accountId, plan)

    const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId)
    const seatItem = subscription.items.data.find((item) => item.price?.id === seatPriceId)

    if (billableSeats <= 0) {
      // Drop the seat line entirely when no seats are billable.
      if (seatItem) {
        await stripe.subscriptionItems.del(seatItem.id, {
          proration_behavior: 'create_prorations',
        })
      }
      return { ok: true, quantity: 0 }
    }

    if (seatItem) {
      if (seatItem.quantity !== billableSeats) {
        await stripe.subscriptionItems.update(seatItem.id, {
          quantity: billableSeats,
          proration_behavior: 'create_prorations',
        })
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: account.stripeSubscriptionId,
        price: seatPriceId,
        quantity: billableSeats,
        proration_behavior: 'create_prorations',
      })
    }

    return { ok: true, quantity: billableSeats }
  } catch (err) {
    console.error('[syncSeatQuantityForAccount]', accountId, err)
    return { ok: false, reason: 'error' }
  }
}
