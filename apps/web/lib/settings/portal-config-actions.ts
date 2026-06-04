'use server'

import type { ActionResult } from '@/lib/auth/types'
import { getAdminSession } from '@/lib/auth/session'
import { ROLE_RANK } from '@/lib/auth/constants'
import { db } from '@/lib/db/client'
import {
  PORTAL_SECTION_IDS,
  type PortalConfig,
  type PortalFeatureHighlight,
  type PortalServiceOffering,
  parsePortalConfig,
} from '@/lib/portal/config'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const serviceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(500),
})

const featureSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(500),
})

const portalConfigSchema = z.object({
  welcomeTitle: z.string().min(2).max(160),
  welcomeMessage: z.string().min(10).max(2000),
  tagline: z.string().max(160),
  pipelineLabel: z.string().max(80),
  showServicesOnOverview: z.boolean(),
  sections: z.record(
    z.enum(PORTAL_SECTION_IDS as unknown as [string, ...string[]]),
    z.object({
      enabled: z.boolean(),
      label: z.string().max(40),
    }),
  ),
  services: z.array(serviceSchema).max(12),
  features: z.array(featureSchema).max(8),
  supportEmail: z.string().email().optional().or(z.literal('')),
  supportPhone: z.string().max(30).optional().or(z.literal('')),
  bookingLink: z.string().url().optional().or(z.literal('')),
  paymentLink: z.string().url().optional().or(z.literal('')),
})

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

function withIds<T extends { id?: string; title: string; description: string }>(
  items: T[],
  prefix: string,
): Array<{ id: string; title: string; description: string }> {
  return items.map((item, index) => ({
    id: item.id?.trim() || `${prefix}-${index}`,
    title: item.title.trim(),
    description: item.description.trim(),
  }))
}

export async function getPortalCustomizationSettings(): Promise<
  ActionResult<{ config: PortalConfig; accountName: string }>
> {
  const session = await getAdminSession()
  if (!session) return err('Your session expired. Refresh and sign in again.')

  const rank = ROLE_RANK[session.role] ?? 0
  if (rank < ROLE_RANK.admin) {
    return err('You do not have permission to edit portal settings.')
  }

  const [account] = await db
    .select({
      name: accounts.name,
      portalConfig: accounts.portalConfig,
      bookingLink: accounts.bookingLink,
      paymentLink: accounts.paymentLink,
      valueProposition: accounts.valueProposition,
    })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  if (!account) return err('Workspace not found')

  return {
    success: true,
    data: {
      accountName: account.name,
      config: parsePortalConfig(account.portalConfig, {
        name: account.name,
        bookingLink: account.bookingLink,
        paymentLink: account.paymentLink,
        valueProposition: account.valueProposition,
      }),
    },
  }
}

export async function updatePortalCustomization(
  input: z.infer<typeof portalConfigSchema>,
): Promise<ActionResult<{ saved: true }>> {
  const session = await getAdminSession()
  if (!session) return err('Your session expired. Refresh and sign in again.')

  const rank = ROLE_RANK[session.role] ?? 0
  if (rank < ROLE_RANK.admin) {
    return err('You do not have permission to edit portal settings.')
  }

  const parsed = portalConfigSchema.safeParse(input)
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'Invalid portal settings')
  }

  const payload: PortalConfig = {
    ...parsed.data,
    supportEmail: parsed.data.supportEmail?.trim() || null,
    supportPhone: parsed.data.supportPhone?.trim() || null,
    bookingLink: parsed.data.bookingLink?.trim() || null,
    paymentLink: parsed.data.paymentLink?.trim() || null,
    services: withIds(parsed.data.services, 'service') as PortalServiceOffering[],
    features: withIds(parsed.data.features, 'feature') as PortalFeatureHighlight[],
  }

  await db
    .update(accounts)
    .set({
      portalConfig: payload,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, session.accountId))

  revalidatePath('/admin/settings')
  revalidatePath('/admin/portal')
  revalidatePath('/portal', 'layout')

  return { success: true, data: { saved: true } }
}
