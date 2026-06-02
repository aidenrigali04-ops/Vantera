import { getServiceClient } from '@/lib/api-guard'
import { env } from '@/lib/env'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10',
})

export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhooks are not configured' }, { status: 503 })
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

  const supabase = getServiceClient()

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle()

      if (account) {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_cents: invoice.amount_paid,
          })
          .eq('stripe_invoice_id', invoice.id)
          .eq('account_id', account.id)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('stripe_customer_id', invoice.customer as string)
        .maybeSingle()

      if (account) {
        await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .eq('stripe_invoice_id', invoice.id)
          .eq('account_id', account.id)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
