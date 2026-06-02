'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { getAccount } from '@/lib/db/queries'
import { env } from '@/lib/env'
import { derivePortalLoginUrl, derivePortalUrl } from '@/lib/portal/url'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { activities, contacts } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { z } from 'zod'

const contactIdSchema = z.string().uuid()

const INVITE_COOLDOWN_MS = 60_000

type PortalContactRow = typeof contacts.$inferSelect

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

async function findOwnedContact(
  accountId: string,
  contactId: string,
): Promise<PortalContactRow | null> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.id, contactId),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  return contact ?? null
}

async function logPortalActivity(
  accountId: string,
  contactId: string,
  userId: string,
  activityType: string,
  body: string,
) {
  await db.insert(activities).values({
    accountId,
    contactId,
    actorType: 'user',
    actorId: userId,
    activityType,
    body,
    visibleToClient: false,
  })
}

async function createPortalAuthLink(email: string, portalUrl: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const redirectTo = `${portalUrl.replace(/\/$/, '')}/auth/portal-callback`

  const invite = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  })

  if (!invite.error && invite.data?.properties?.action_link) {
    return invite.data.properties.action_link
  }

  const magic = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (magic.error || !magic.data?.properties?.action_link) {
    return null
  }

  return magic.data.properties.action_link
}

async function sendPortalInviteEmail(input: {
  to: string
  contactName: string
  accountName: string
  portalUrl: string
  magicLink: string
}): Promise<boolean> {
  const resendKey = env.RESEND_API_KEY
  if (!resendKey) {
    return false
  }

  const resend = new Resend(resendKey)
  const fromAddress = `${input.accountName} <onboarding@${env.NEXT_PUBLIC_APP_DOMAIN}>`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 16px">Your client portal is ready</h1>
      <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 24px">
        Hi ${input.contactName}, ${input.accountName} has invited you to your client portal.
        View project progress, documents, invoices, and message your team in one place.
      </p>
      <p style="margin:0 0 32px">
        <a href="${input.magicLink}"
           style="background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500;display:inline-block">
          Open client portal
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin:0">
        Portal URL: <span style="word-break:break-all">${input.portalUrl}</span><br /><br />
        If the button doesn't work, copy this link into your browser:<br />
        <span style="word-break:break-all">${input.magicLink}</span>
      </p>
    </div>
  `

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: input.to,
    subject: `${input.accountName} — your client portal`,
    html,
  })

  return !error
}

async function deliverPortalInvite(
  session: { accountId: string; userId: string },
  contact: PortalContactRow,
  options: { resendOnly?: boolean },
): Promise<ActionResult<{ sent: boolean }>> {
  const email = contact.email?.toLowerCase().trim()
  if (!email) {
    return err('Add an email address before inviting this client to the portal')
  }

  if (options.resendOnly && !contact.portalAccess) {
    return err('Portal access is not enabled for this contact')
  }

  if (
    contact.portalInvitedAt &&
    Date.now() - contact.portalInvitedAt.getTime() < INVITE_COOLDOWN_MS
  ) {
    return err('Invite was sent recently. Wait a minute before resending.')
  }

  const account = await getAccount(session.accountId)
  if (!account) {
    return err('Workspace not found')
  }

  const portalUrl = derivePortalUrl(account.slug, account.portalDomain)
  const magicLink = await createPortalAuthLink(email, portalUrl)

  if (!magicLink) {
    return err('Could not create a secure sign-in link. Try again in a moment.')
  }

  const contactName = `${contact.firstName} ${contact.lastName}`.trim() || email
  const accountName = account.name || 'Your team'

  const sent = await sendPortalInviteEmail({
    to: email,
    contactName,
    accountName,
    portalUrl,
    magicLink,
  })

  if (!sent) {
    return err('Could not send the invite email. Check your email configuration.')
  }

  await db
    .update(contacts)
    .set({
      portalAccess: true,
      portalInvitedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contact.id), eq(contacts.accountId, session.accountId)))

  await logPortalActivity(
    session.accountId,
    contact.id,
    session.userId,
    options.resendOnly ? 'portal_invite_resent' : 'portal_access_granted',
    options.resendOnly
      ? `Portal invite resent to ${email}`
      : `Portal access enabled and invite sent to ${email}`,
  )

  revalidatePath(`/admin/clients/${contact.id}`)
  revalidatePath('/admin/portal')

  return { success: true, data: { sent: true } }
}

export async function inviteContactToPortal(
  contactId: string,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = contactIdSchema.safeParse(contactId)
  if (!parsed.success) {
    return err('Invalid contact')
  }

  const session = await requireAdminSession()
  const contact = await findOwnedContact(session.accountId, parsed.data)

  if (!contact) {
    return err('Contact not found')
  }

  return deliverPortalInvite(session, contact, { resendOnly: false })
}

export async function resendPortalInvite(
  contactId: string,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = contactIdSchema.safeParse(contactId)
  if (!parsed.success) {
    return err('Invalid contact')
  }

  const session = await requireAdminSession()
  const contact = await findOwnedContact(session.accountId, parsed.data)

  if (!contact) {
    return err('Contact not found')
  }

  return deliverPortalInvite(session, contact, { resendOnly: true })
}

export async function revokeContactPortalAccess(
  contactId: string,
): Promise<ActionResult<{ revoked: true }>> {
  const parsed = contactIdSchema.safeParse(contactId)
  if (!parsed.success) {
    return err('Invalid contact')
  }

  const session = await requireAdminSession()
  const contact = await findOwnedContact(session.accountId, parsed.data)

  if (!contact) {
    return err('Contact not found')
  }

  if (!contact.portalAccess) {
    return { success: true, data: { revoked: true } }
  }

  await db
    .update(contacts)
    .set({
      portalAccess: false,
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contact.id), eq(contacts.accountId, session.accountId)))

  await logPortalActivity(
    session.accountId,
    contact.id,
    session.userId,
    'portal_access_revoked',
    'Portal access revoked',
  )

  revalidatePath(`/admin/clients/${contact.id}`)
  revalidatePath('/admin/portal')

  return { success: true, data: { revoked: true } }
}

export async function getPortalAccessMeta(accountId: string): Promise<{
  portalUrl: string
  portalLoginUrl: string
}> {
  const account = await getAccount(accountId)
  const portalUrl = account
    ? derivePortalUrl(account.slug, account.portalDomain)
    : derivePortalUrl('workspace', null)
  const portalLoginUrl = account
    ? derivePortalLoginUrl(account.slug, account.portalDomain)
    : derivePortalLoginUrl('workspace', null)

  return { portalUrl, portalLoginUrl }
}
