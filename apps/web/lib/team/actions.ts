'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { syncSeatQuantityForAccount } from '@/lib/stripe/seats'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { accountInvites, users } from '@vantera/db'
import { createHash, randomBytes } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { z } from 'zod'

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

function err(message: string): { success: false; error: string } {
  return { success: false, error: message }
}

/** Roles assignable to an invited teammate (owner is not invitable). */
const INVITE_ROLES = ['admin', 'manager', 'staff', 'technician', 'agent'] as const

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(INVITE_ROLES),
})

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function canManageTeam(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export async function inviteTeamSeat(input: {
  email: string
  role: string
}): Promise<ActionResult<{ inviteId: string }>> {
  const session = await requireAdminSession()
  if (!canManageTeam(session.role)) {
    return err('Only owners and admins can invite teammates')
  }

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'Invalid invite')
  }
  const { email, role } = parsed.data

  const [existingMember] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.accountId, session.accountId), eq(users.email, email), isNull(users.deletedAt)),
    )
    .limit(1)
  if (existingMember) {
    return err('That person is already on your team')
  }

  const [pending] = await db
    .select({ id: accountInvites.id })
    .from(accountInvites)
    .where(
      and(
        eq(accountInvites.accountId, session.accountId),
        eq(accountInvites.email, email),
        eq(accountInvites.status, 'pending'),
      ),
    )
    .limit(1)
  if (pending) {
    return err('An invite is already pending for that email')
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const [invite] = await db
    .insert(accountInvites)
    .values({
      accountId: session.accountId,
      email,
      role,
      status: 'pending',
      tokenHash,
      invitedBy: session.userId,
      expiresAt,
    })
    .returning({ id: accountInvites.id })

  if (!invite) {
    return err('Could not create the invite. Please try again.')
  }

  // Email is best-effort — the invite exists and counts toward seats regardless.
  try {
    const account = await fetchAccountById(session.accountId)
    const accountName = account?.name || 'Your workspace'
    const supabase = getSupabaseAdmin()
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
    const magicLink = linkData?.properties?.action_link ?? `${env.NEXT_PUBLIC_APP_URL}/auth/login`

    if (env.RESEND_API_KEY) {
      const resend = new Resend(env.RESEND_API_KEY)
      await resend.emails.send({
        from: `${accountName} <onboarding@${env.NEXT_PUBLIC_APP_DOMAIN}>`,
        to: email,
        subject: `You've been invited to join ${accountName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a">
            <h1 style="font-size:20px;margin:0 0 16px">You've been invited to join ${accountName}</h1>
            <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 24px">
              ${accountName} added you as a <strong>${role}</strong>. Accept the invite to set up your account.
            </p>
            <p style="margin:0 0 32px">
              <a href="${magicLink}" style="background:#1648A0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500;display:inline-block">Accept invitation</a>
            </p>
            <p style="font-size:12px;color:#64748b;margin:0">If the button doesn't work, paste this link:<br /><span style="word-break:break-all">${magicLink}</span></p>
          </div>
        `,
      })
    }
  } catch (emailErr) {
    console.error('[inviteTeamSeat] email send failed', emailErr)
  }

  await syncSeatQuantityForAccount(session.accountId)
  revalidatePath('/admin/settings')
  return { success: true, data: { inviteId: invite.id } }
}

export async function revokeTeamInvite(
  inviteId: string,
): Promise<ActionResult<{ revoked: true }>> {
  const session = await requireAdminSession()
  if (!canManageTeam(session.role)) {
    return err('Only owners and admins can manage invites')
  }

  const [invite] = await db
    .select({ id: accountInvites.id, accountId: accountInvites.accountId, status: accountInvites.status })
    .from(accountInvites)
    .where(eq(accountInvites.id, inviteId))
    .limit(1)

  if (!invite || invite.accountId !== session.accountId) {
    return err('Invite not found')
  }
  if (invite.status !== 'pending') {
    return err('That invite is no longer pending')
  }

  await db
    .update(accountInvites)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(accountInvites.id, inviteId))

  await syncSeatQuantityForAccount(session.accountId)
  revalidatePath('/admin/settings')
  return { success: true, data: { revoked: true } }
}

export async function removeTeamMember(
  userId: string,
): Promise<ActionResult<{ removed: true }>> {
  const session = await requireAdminSession()
  if (!canManageTeam(session.role)) {
    return err('Only owners and admins can remove members')
  }
  if (userId === session.userId) {
    return err("You can't remove yourself")
  }

  const [member] = await db
    .select({ id: users.id, accountId: users.accountId, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!member || member.accountId !== session.accountId) {
    return err('Member not found')
  }
  if (member.role === 'owner') {
    return err("The workspace owner can't be removed")
  }

  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(users.id, userId))

  await syncSeatQuantityForAccount(session.accountId)
  revalidatePath('/admin/settings')
  return { success: true, data: { removed: true } }
}
