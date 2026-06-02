'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findContact } from '@/lib/db/queries'
import { connectStripe, disconnectStripe } from '@/lib/integrations/payment-connect'
import { getStripeForAccount } from '@/lib/stripe/client'
import { ensureStripeCustomer } from '@/lib/stripe/customers'
import { createStripeInvoice, mapStripeInvoiceStatus } from '@/lib/stripe/invoices'
import { db } from '@/lib/db/client'
import { invoices } from '@vantera/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const connectStripeSchema = z.object({
  secretKey: z.string().min(10),
  publishableKey: z.string().optional(),
})

const createInvoiceSchema = z.object({
  contactId: z.string().uuid(),
  recordId: z.string().uuid(),
  amountCents: z.number().int().min(50).max(99_999_999),
  description: z.string().min(1).max(500),
  daysUntilDue: z.number().int().min(1).max(90).optional().default(14),
})

export async function connectStripeAction(
  input: z.infer<typeof connectStripeSchema>,
): Promise<ActionResult<{ connected: true }>> {
  const session = await requireAdminSession()
  const parsed = connectStripeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Invalid Stripe credentials' }
  }

  const result = await connectStripe(session.accountId, parsed.data)
  if (!result.ok) {
    return { success: false, error: result.reason }
  }

  revalidatePath('/admin/billing')
  revalidatePath('/admin/integrations')
  return { success: true, data: { connected: true } }
}

export async function disconnectStripeAction(): Promise<ActionResult> {
  const session = await requireAdminSession()
  await disconnectStripe(session.accountId)
  revalidatePath('/admin/billing')
  return { success: true, data: undefined }
}

export async function createBillingInvoiceAction(
  input: z.infer<typeof createInvoiceSchema>,
): Promise<
  ActionResult<{
    invoiceId: string
    hostedInvoiceUrl: string | null
  }>
> {
  const session = await requireAdminSession()
  const parsed = createInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const stripeResult = await getStripeForAccount(session.accountId)
  if (!stripeResult.ok) {
    return { success: false, error: stripeResult.reason }
  }

  const contact = await findContact(session.accountId, parsed.data.contactId)
  if (!contact) {
    return { success: false, error: 'Contact not found' }
  }

  try {
    const customerId = await ensureStripeCustomer(
      stripeResult.stripe,
      session.accountId,
      contact,
    )

    const stripeInvoice = await createStripeInvoice(stripeResult.stripe, {
      customerId,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description,
      daysUntilDue: parsed.data.daysUntilDue,
    })

    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + parsed.data.daysUntilDue)

    const [row] = await db
      .insert(invoices)
      .values({
        accountId: session.accountId,
        contactId: parsed.data.contactId,
        recordId: parsed.data.recordId,
        stripeInvoiceId: stripeInvoice.stripeInvoiceId,
        amountCents: parsed.data.amountCents,
        paidCents: 0,
        status: mapStripeInvoiceStatus(stripeInvoice.status),
        dueAt,
        paymentLinkUrl: stripeInvoice.hostedInvoiceUrl,
        lineItems: [
          {
            description: parsed.data.description,
            amount_cents: parsed.data.amountCents,
            quantity: 1,
          },
        ],
      })
      .returning({ id: invoices.id })

    if (!row) {
      return { success: false, error: 'Failed to save invoice' }
    }

    revalidatePath('/admin/billing')
    return {
      success: true,
      data: {
        invoiceId: row.id,
        hostedInvoiceUrl: stripeInvoice.hostedInvoiceUrl,
      },
    }
  } catch (err) {
    console.error('[createBillingInvoiceAction]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not create Stripe invoice',
    }
  }
}
