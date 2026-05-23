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

const signupSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

  // If the owner of an un-onboarded account is signing in, drop them
  // directly into the wizard. The admin layout would do the same redirect
  // anyway, but doing it here avoids a visible flash through /admin/dashboard.
  const onboardingComplete = isOnboardingComplete(account)
  const redirectTo =
    !onboardingComplete && user.role === 'owner' ? '/admin/onboarding' : '/admin/dashboard'

  return { success: true, data: { redirectTo } }
}

function isOnboardingComplete(account: { onboarding_completed_at?: string | null }): boolean {
  return Boolean(account.onboarding_completed_at)
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

async function findUniqueSlug(base: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const fallback = base || 'business'
  let candidate = fallback

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await admin
      .from('accounts')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
      .maybeSingle()

    if (!data) {
      return candidate
    }

    candidate = `${fallback}-${randomSuffix()}`
  }

  return `${fallback}-${Date.now().toString(36).slice(-6)}`
}

export async function signupAction(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const validated = signupSchema.safeParse(input)

  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message ?? 'Invalid signup details',
    }
  }

  const admin = getSupabaseAdmin()
  const { businessName, email, password } = validated.data

  // 1) Create the Supabase auth user. email_confirm:true bypasses the
  //    verification email so the user can start onboarding immediately.
  const createResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { business_name: businessName },
  })

  if (createResult.error || !createResult.data.user) {
    const message = createResult.error?.message ?? 'Failed to create account'
    if (message.toLowerCase().includes('registered') || message.toLowerCase().includes('exists')) {
      return { success: false, error: 'An account with this email already exists. Try signing in.' }
    }
    return { success: false, error: message }
  }

  const authUserId = createResult.data.user.id

  // 2) Allocate a unique slug for this business.
  const baseSlug = slugify(businessName)
  const slug = await findUniqueSlug(baseSlug)

  // 3) Insert the account. Vertical is required by the schema but the user
  //    selects it in Step 1 of the wizard; default to 'agency' as a
  //    placeholder that will be overwritten by updateVertical.
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      slug,
      name: businessName,
      vertical: 'agency',
      plan: 'team',
    })
    .select('id, slug')
    .single()

  if (accountError || !account) {
    // Roll back the auth user so the email can be reused on retry.
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: accountError?.message ?? 'Failed to create workspace' }
  }

  // 4) Insert the owner user row. fullName defaults to the email local-part —
  //    the user can change this in profile settings later.
  const fullName = email.split('@')[0] ?? email
  const { error: userError } = await admin.from('users').insert({
    account_id: account.id,
    email,
    full_name: fullName,
    role: 'owner',
    is_active: true,
  })

  if (userError) {
    await admin.from('accounts').delete().eq('id', account.id)
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: userError.message }
  }

  // 5) Look up the inserted user so we have its UUID for the session payload.
  const { data: userRow } = await admin
    .from('users')
    .select('id')
    .eq('account_id', account.id)
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (!userRow) {
    return { success: false, error: 'Failed to finalize account setup' }
  }

  // 6) Sign the user in via Supabase (sets Supabase's sb-* cookies) and then
  //    mint our own admin session cookie.
  const supabase = createSupabaseServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    return { success: false, error: signInError.message }
  }

  await setAdminSession({
    type: 'admin',
    userId: userRow.id,
    accountId: account.id,
    role: 'owner',
    email,
  })

  // 7) Build the redirect target. The goal: drop the user on a host that
  //    middleware will resolve to THIS new account, not a different tenant.
  //
  //    - If we're on the configured app domain (apex or any tenant subdomain),
  //      DNS for *.<appDomain> is presumed to exist, so jump to
  //      <slug>.<appDomain>/admin/onboarding. Cross-subdomain cookies keep
  //      the user signed in.
  //    - If we're on anything else (Vercel preview, *.vercel.app, localhost,
  //      lvh.me, etc.), stay on the current host and rely on the session-
  //      cookie tenant fallback in middleware/resolve-account.
  const host = headers().get('host') ?? ''
  const hostname = host.split(':')[0] ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''

  const onAppDomain = Boolean(
    appDomain && (hostname === appDomain || hostname.endsWith(`.${appDomain}`)),
  )
  const onCorrectSubdomain = Boolean(appDomain && hostname === `${account.slug}.${appDomain}`)

  if (onAppDomain && !onCorrectSubdomain) {
    const target = `https://${account.slug}.${appDomain}/admin/onboarding`
    return { success: true, data: { redirectTo: target } }
  }

  return { success: true, data: { redirectTo: '/admin/onboarding' } }
}
