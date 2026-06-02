import { getServiceClient } from '@/lib/api-guard'
import { env } from '@/lib/env'
import { mapStripeInvoiceStatus } from '@/lib/stripe/invoices'
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  applyStripeBillingToAccount,
  customerIdFromStripe,
  planIdFromSubscription,
} from '@/lib/stripe/sync-account-billing'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function syncClientInvoiceFromStripe(stripeInvoice: Stripe.Invoice): Promise<void> {
  const supabase = getServiceClient()
  const status = mapStripeInvoiceStatus(stripeInvoice.status)
  const paidAt =
    stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at
      ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
      : null

  const { error } = await supabase
    .from('invoices')
    .update({
      status,
      paid_cents: stripeInvoice.amount_paid ?? 0,
      paid_at: paidAt,
      payment_link_url: stripeInvoice.hosted_invoice_url ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_invoice_id', stripeInvoice.id)

  if (error) {
    console.error('[Stripe Webhook] Failed to sync client invoice', stripeInvoice.id, error)
  }
}

async function syncSubscriptionToAccount(subscription: Stripe.Subscription): Promise<void> {
  const accountId = subscription.metadata?.account_id
  if (!accountId) return

  const planId = planIdFromSubscription(subscription)
  if (!planId) return

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null

  if (
    subscription.status === 'canceled' ||
    subscription.status === 'unpaid' ||
    subscription.status === 'incomplete_expired'
  ) {
    await applyStripeBillingToAccount({
      accountId,
      planId: 'free',
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
    })
    return
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    await applyStripeBillingToAccount({
      accountId,
      planId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
    })
  }
}

export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhooks are not configured' }, { status: 503 })
  }

  const stripe = getPlatformStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const accountId = session.metadata?.account_id
      const planMeta = session.metadata?.plan_id
      if (!accountId || (planMeta !== 'team' && planMeta !== 'enterprise')) break

      const customerId = customerIdFromStripe(session.customer)
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null

      await applyStripeBillingToAccount({
        accountId,
        planId: planMeta,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      })
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await syncSubscriptionToAccount(subscription)
      break
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
    case 'invoice.finalized':
    case 'invoice.voided': {
      const invoice = event.data.object as Stripe.Invoice
      await syncClientInvoiceFromStripe(invoice)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
