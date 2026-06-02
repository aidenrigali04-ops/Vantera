import { db } from '@/lib/db/client'
import { contacts, invoices, records } from '@vantera/db'
import { and, desc, eq, isNull } from 'drizzle-orm'

export type BillingInvoiceRow = {
  id: string
  contactId: string
  recordId: string
  contactName: string
  recordTitle: string | null
  amountCents: number
  paidCents: number
  status: string
  dueAt: Date | null
  paidAt: Date | null
  paymentLinkUrl: string | null
  stripeInvoiceId: string | null
  createdAt: Date
}

export async function findBillingInvoices(
  accountId: string,
  limit = 50,
): Promise<BillingInvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      contactId: invoices.contactId,
      recordId: invoices.recordId,
      amountCents: invoices.amountCents,
      paidCents: invoices.paidCents,
      status: invoices.status,
      dueAt: invoices.dueAt,
      paidAt: invoices.paidAt,
      paymentLinkUrl: invoices.paymentLinkUrl,
      stripeInvoiceId: invoices.stripeInvoiceId,
      createdAt: invoices.createdAt,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      recordTitle: records.title,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.contactId, contacts.id))
    .innerJoin(records, eq(invoices.recordId, records.id))
    .where(and(eq(invoices.accountId, accountId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    contactId: row.contactId,
    recordId: row.recordId,
    contactName: [row.firstName, row.lastName].filter(Boolean).join(' '),
    recordTitle: row.recordTitle,
    amountCents: row.amountCents,
    paidCents: row.paidCents,
    status: row.status,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
    paymentLinkUrl: row.paymentLinkUrl,
    stripeInvoiceId: row.stripeInvoiceId,
    createdAt: row.createdAt,
  }))
}

export type InvoiceTargetOption = {
  contactId: string
  recordId: string
  label: string
}

/** Contacts with at least one active record — required to create an invoice row. */
export async function findInvoiceTargets(accountId: string): Promise<InvoiceTargetOption[]> {
  const rows = await db
    .select({
      contactId: contacts.id,
      recordId: records.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      recordTitle: records.title,
    })
    .from(records)
    .innerJoin(contacts, eq(records.contactId, contacts.id))
    .where(
      and(
        eq(records.accountId, accountId),
        isNull(records.deletedAt),
        isNull(contacts.deletedAt),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(200)

  return rows.map((row) => ({
    contactId: row.contactId,
    recordId: row.recordId,
    label: `${[row.firstName, row.lastName].filter(Boolean).join(' ')} — ${row.recordTitle}`,
  }))
}
