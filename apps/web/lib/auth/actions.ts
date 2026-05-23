'use server'

import { resolveAccountFromHost } from '@/lib/auth/resolve-account'
import {
  clearAdminSession,
  clearPortalSession,
  setAdminSession,
  setPortalSession,
} from '@/lib/auth/session'
import type { ActionResult } from '@/lib/auth/types'
import type { UserRole } from '@/lib/auth/constants'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type AdminUserRow = {
  id: string
  email: string
  role: string
}

type PortalContactRow = {
  id: string
  email: string | null
}

async function findActiveAdminUser(accountId: string, email: string): Promise<AdminUserRow | null> {
  // Uses the Supabase REST API instead of direct Postgres so login works on
  // Supabase projects whose legacy db.<ref>.supabase.co host has been retired
  // (newer projects must use the Supavisor pooler URL for direct Postgres).
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('users')
    .select('id, email, role, is_active, deleted_at, account_id')
    .eq('account_id', accountId)
    .eq('email', email)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return { id: data.id, email: data.email, role: data.role }
}

async function findPortalContact(accountId: string, email: string): Promise<PortalContactRow | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('contacts')
    .select('id, email, portal_access, deleted_at, account_id')
    .eq('account_id', accountId)
    .eq('email', email)
    .eq('portal_access', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return { id: data.id, email: data.email }
}

export async function adminLoginAction(
  input: z.infer<typeof loginSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const validated = loginSchema.safeParse(input)

  if (!validated.success) {
    return { success: false, error: 'Invalid email or password' }
  }

  const host = headers().get('host') ?? ''
  const account = await resolveAccountFromHost(host)

  if (!account) {
    return { success: false, error: 'Account not found' }
  }

  const supabase = createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  })

  if (authError || !authData.user) {
    return { success: false, error: 'Invalid email or password' }
  }

  const user = await findActiveAdminUser(account.id, validated.data.email)

  if (!user) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  await setAdminSession({
    type: 'admin',
    userId: user.id,
    accountId: account.id,
    role: user.role as UserRole,
    email: user.email,
  })

  return { success: true, data: { redirectTo: '/admin/dashboard' } }
}

export async function portalLoginAction(
  input: z.infer<typeof loginSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const validated = loginSchema.safeParse(input)

  if (!validated.success) {
    return { success: false, error: 'Invalid email or password' }
  }

  const host = headers().get('host') ?? ''
  const account = await resolveAccountFromHost(host)

  if (!account) {
    return { success: false, error: 'Account not found' }
  }

  const supabase = createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  })

  if (authError || !authData.user) {
    return { success: false, error: 'Invalid email or password' }
  }

  const contact = await findPortalContact(account.id, validated.data.email)

  if (!contact) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  await setPortalSession({
    type: 'portal',
    contactId: contact.id,
    accountId: account.id,
    email: contact.email ?? validated.data.email,
  })

  return { success: true, data: { redirectTo: '/portal' } }
}

export async function adminLogoutAction(): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  await clearAdminSession()
  redirect('/auth/login')
}

export async function portalLogoutAction(): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  await clearPortalSession()
  redirect('/auth/portal-login')
}
