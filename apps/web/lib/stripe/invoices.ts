import type Stripe from 'stripe'

export type CreateStripeInvoiceInput = {
  customerId: string
  amountCents: number
  description: string
  daysUntilDue?: number
}

export type CreateStripeInvoiceResult = {
  stripeInvoiceId: string
  hostedInvoiceUrl: string | null
  status: string
}

export async function createStripeInvoice(
  stripe: Stripe,
  input: CreateStripeInvoiceInput,
): Promise<CreateStripeInvoiceResult> {
  const daysUntilDue = input.daysUntilDue ?? 14

  const draft = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    auto_advance: false,
  })

  await stripe.invoiceItems.create({
    customer: input.customerId,
    invoice: draft.id,
    amount: input.amountCents,
    currency: 'usd',
    description: input.description.slice(0, 500),
  })

  const finalized = await stripe.invoices.finalizeInvoice(draft.id)
  const sent = await stripe.invoices.sendInvoice(finalized.id)

  return {
    stripeInvoiceId: sent.id,
    hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
    status: sent.status ?? 'open',
  }
}

export function mapStripeInvoiceStatus(
  stripeStatus: string | null | undefined,
): 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'voided' {
  switch (stripeStatus) {
    case 'paid':
      return 'paid'
    case 'open':
      return 'sent'
    case 'uncollectible':
      return 'overdue'
    case 'void':
      return 'voided'
    case 'draft':
      return 'draft'
    default:
      return 'sent'
  }
}
