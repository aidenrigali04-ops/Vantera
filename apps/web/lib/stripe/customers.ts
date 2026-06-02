import type Stripe from 'stripe'
import type { contacts } from '@vantera/db'

type ContactRow = typeof contacts.$inferSelect

export async function ensureStripeCustomer(
  stripe: Stripe,
  accountId: string,
  contact: Pick<ContactRow, 'id' | 'email' | 'firstName' | 'lastName' | 'phone' | 'company'>,
): Promise<string> {
  const email = contact.email?.trim()
  if (!email) {
    throw new Error('Contact needs an email address before you can send a Stripe invoice.')
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
  const metadata = {
    vantera_account_id: accountId,
    vantera_contact_id: contact.id,
  }

  const existing = await stripe.customers.list({ email, limit: 1 })
  const match = existing.data.find(
    (c) => c.metadata?.vantera_contact_id === contact.id || c.email === email,
  )

  if (match) {
    if (match.metadata?.vantera_contact_id !== contact.id) {
      await stripe.customers.update(match.id, { metadata, name: name || undefined })
    }
    return match.id
  }

  const created = await stripe.customers.create({
    email,
    name: name || undefined,
    phone: contact.phone ?? undefined,
    metadata,
    description: contact.company ?? undefined,
  })

  return created.id
}
