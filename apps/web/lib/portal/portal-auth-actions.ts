'use server'

import {
  findAccountByPortalEmail,
  resolveAccountFromHost,
} from '@/lib/auth/resolve-account'
import { setPortalSession } from '@/lib/auth/session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import {
  findValidPortalInviteToken,
  markPortalInviteTokenUsed,
} from '@/lib/portal/auth-tokens'
import { hashPortalPassword } from '@/lib/portal/password'
import { contacts } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'

const activateSchema = z.object({
  token: z.string().min(16),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/\d/, 'Password must include at least one number'),
})

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

export type PortalActivatePreview = {
  email: string
  accountName: string
  hasExistingAccount: boolean
}

export async function getPortalActivatePreview(
  rawToken: string,
): Promise<ActionResult<PortalActivatePreview>> {
  const match = await findValidPortalInviteToken(rawToken.trim())
  if (!match) {
    return err('This invite link is invalid or has expired. Ask your provider to resend the invite.')
  }

  const email = match.contact.email?.trim()
  if (!email) {
    return err('This invite is missing an email address. Contact your provider.')
  }

  return {
    success: true,
    data: {
      email,
      accountName: match.account.name?.trim() || 'Your team',
      hasExistingAccount: Boolean(match.contact.portalPasswordHash),
    },
  }
}

export async function activatePortalAccountAction(
  input: z.infer<typeof activateSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const validated = activateSchema.safeParse(input)
  if (!validated.success) {
    return err(validated.error.issues[0]?.message ?? 'Invalid request')
  }

  const match = await findValidPortalInviteToken(validated.data.token.trim())
  if (!match) {
    return err('This invite link is invalid or has expired. Ask your provider to resend the invite.')
  }

  const email = match.contact.email?.toLowerCase().trim()
  if (!email) {
    return err('This invite is missing an email address. Contact your provider.')
  }

  const passwordHash = await hashPortalPassword(validated.data.password)
  const now = new Date()

  await db
    .update(contacts)
    .set({
      portalPasswordHash: passwordHash,
      portalAccountCreatedAt: match.contact.portalAccountCreatedAt ?? now,
      portalLastLoginAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(contacts.id, match.contact.id), eq(contacts.accountId, match.accountId)),
    )

  await markPortalInviteTokenUsed(match.id)

  const host = headers().get('host') ?? ''
  let account = await resolveAccountFromHost(host)
  if (!account || account.id !== match.accountId) {
    account = await findAccountByPortalEmail(email)
  }

  if (!account || account.id !== match.accountId) {
    return {
      success: true,
      data: { redirectTo: '/auth/portal-login' },
    }
  }

  await setPortalSession({
    type: 'portal',
    contactId: match.contact.id,
    accountId: match.accountId,
    email,
  })

  return { success: true, data: { redirectTo: '/portal' } }
}
