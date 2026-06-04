import { isMissingPortalConfigColumn } from '@/lib/db/account-core'
import { getAccount } from '@/lib/db/queries'
import { db } from '@/lib/db/client'
import {
  defaultPortalConfig,
  parsePortalConfig,
  type PortalConfig,
} from '@/lib/portal/portal-config'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function loadPortalConfig(accountId: string): Promise<PortalConfig> {
  try {
    const [account] = await db
      .select({
        name: accounts.name,
        portalConfig: accounts.portalConfig,
        bookingLink: accounts.bookingLink,
        paymentLink: accounts.paymentLink,
        valueProposition: accounts.valueProposition,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!account) {
      return defaultPortalConfig('Your team')
    }

    return parsePortalConfig(account.portalConfig, {
      name: account.name,
      bookingLink: account.bookingLink,
      paymentLink: account.paymentLink,
      valueProposition: account.valueProposition,
    })
  } catch (error) {
    if (!isMissingPortalConfigColumn(error)) {
      throw error
    }

    const account = await getAccount(accountId)
    return defaultPortalConfig(account?.name ?? 'Your team')
  }
}
