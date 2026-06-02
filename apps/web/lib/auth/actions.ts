'use server'

import {
  findAccountByAdminEmail,
  findAccountByPortalEmail,
  resolveAccountFromHost,
  resolveTenantAccountFromHost,
} from '@/lib/auth/resolve-account'
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
import { DEMO_WORKSPACE_NAME } from '@/lib/onboarding/constants'
import { AUTH_DASHBOARD_PATH, AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'
import { seedSampleWorkspace } from '@/lib/sample-data/seed'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const signupSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name').max(120),
  businessName: z.string().min(2, 'Please enter your business name').max(120),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/\d/, 'Password must include at least one number'),
})

const completeOAuthSignupSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').max(120),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(120),
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

type AdminUserWithAccount = AdminUserRow & { account_id: string; is_active: boolean }

async function findAdminUserByAuthId(authUserId: string): Promise<AdminUserWithAccount | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('users')
    .select('id, email, role, is_active, deleted_at, account_id, created_at')
    .eq('id', authUserId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data?.account_id) {
    return null
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    account_id: data.account_id,
    is_active: data.is_active ?? true,
  }
}

async function findOrLinkAdminUser(
  authUserId: string,
  email: string,
): Promise<AdminUserWithAccount | null> {
  const byId = await findAdminUserByAuthId(authUserId)
  if (byId) {
    return byId
  }

  const admin = getSupabaseAdmin()
  const normalized = email.toLowerCase().trim()

  const { data: byEmail, error } = await admin
    .from('users')
    .select('id, email, role, is_active, account_id, full_name, created_at')
    .eq('email', normalized)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !byEmail?.account_id) {
    return null
  }

  if (byEmail.id !== authUserId) {
    const { error: upsertErr } = await admin.from('users').upsert(
      {
        id: authUserId,
        account_id: byEmail.account_id,
        email: normalized,
        full_name: byEmail.full_name ?? normalized.split('@')[0],
        role: byEmail.role ?? 'owner',
        is_active: true,
        deleted_at: null,
      },
      { onConflict: 'id' },
    )

    if (upsertErr) {
      console.error('[findOrLinkAdminUser] relink failed', upsertErr.message)
      return null
    }

    if (byEmail.id !== authUserId) {
      await admin
        .from('users')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', byEmail.id)
    }
  }

  return {
    id: authUserId,
    email: byEmail.email,
    role: byEmail.role,
    account_id: byEmail.account_id,
    is_active: byEmail.is_active ?? true,
  }
}

async function findActiveAdminUser(accountId: string, email: string): Promise<AdminUserRow | null> {
  // Uses the Supabase REST API instead of direct Postgres so login works on
  // Supabase projects whose legacy db.<ref>.supabase.co host has been retired
  // (newer projects must use the Supavisor pooler URL for direct Postgres).
  const admin = getSupabaseAdmin()
  const normalized = email.toLowerCase().trim()
  const { data, error } = await admin
    .from('users')
    .select('id, email, role, is_active, deleted_at, account_id, created_at')
    .eq('account_id', accountId)
    .eq('email', normalized)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return { id: data.id, email: data.email, role: data.role }
}

async function findPortalContact(accountId: string, email: string): Promise<PortalContactRow | null> {
  const admin = getSupabaseAdmin()
  const normalized = email.toLowerCase().trim()
  const { data, error } = await admin
    .from('contacts')
    .select('id, email, portal_access, deleted_at, account_id, created_at')
    .eq('account_id', accountId)
    .eq('email', normalized)
    .eq('portal_access', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
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

  // Drop any stale workspace cookie before auth — otherwise resolveAccountFromHost
  // can bind the wrong tenant and reject a valid password.
  await clearAdminSession()

  const host = headers().get('host') ?? ''
  const hostAccount = await resolveTenantAccountFromHost(host)
  const normalizedEmail = validated.data.email.toLowerCase().trim()

  const supabase = createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: validated.data.password,
  })

  if (authError || !authData.user) {
    return { success: false, error: 'Invalid email or password' }
  }

  const user = await findOrLinkAdminUser(authData.user.id, normalizedEmail)

  if (!user || !user.is_active) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  if (user.email.toLowerCase().trim() !== normalizedEmail) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  if (hostAccount && hostAccount.id !== user.account_id) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  const { fetchAccountById } = await import('@/lib/onboarding/account-store')
  let account = hostAccount ?? (await fetchAccountById(user.account_id))

  if (!account?.id) {
    account = await findAccountByAdminEmail(normalizedEmail)
  }

  if (!account?.id) {
    await supabase.auth.signOut()
    return { success: false, error: 'Invalid email or password' }
  }

  await setAdminSession({
    type: 'admin',
    userId: user.id,
    accountId: user.account_id,
    role: user.role as UserRole,
    email: user.email,
  })

  const redirectTo = isOnboardingComplete(account) ? AUTH_DASHBOARD_PATH : AUTH_ONBOARDING_PATH

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

  let account = await resolveAccountFromHost(host)
  if (!account) {
    account = await findAccountByPortalEmail(validated.data.email)
  }

  if (!account) {
    return { success: false, error: 'Invalid email or password' }
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

  redirect('/portal')
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

/** Lightweight availability check for signup email blur validation. */
export async function checkEmailAvailableAction(
  email: string,
): Promise<ActionResult<{ available: boolean }>> {
  const parsed = z.string().email().safeParse(email.trim().toLowerCase())
  if (!parsed.success) {
    return { success: true, data: { available: true } }
  }

  try {
    const admin = getSupabaseAdmin()
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', parsed.data)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    return { success: true, data: { available: !existingUser } }
  } catch {
    return { success: false, error: 'Could not verify email availability' }
  }
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
  const { fullName, businessName, email, password } = validated.data
  const normalizedEmail = email.toLowerCase().trim()

  // DO NOT call supabase.auth.signOut() here. signOut() pushes Set-Cookie
  // headers that delete the sb-* cookies into this response, and on some
  // edge-runtime / hosted setups those delete headers race with the
  // signInWithPassword() Set-Cookie headers issued later in the same
  // action — leaving the user with NO valid Supabase session cookies on
  // the next request. signInWithPassword() already overwrites sb-* in
  // place; we don't need to delete them first.

  // 0b) Guard against orphaned Vantera users rows. If the email already
  //     has a users row (regardless of whether a Supabase auth user
  //     still exists), refuse the signup — otherwise we'd end up with
  //     two rows for the same email pointing to different account_ids,
  //     and routing would become non-deterministic.
  const { data: existingUser } = await admin
    .from('users')
    .select('id, account_id')
    .eq('email', normalizedEmail)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (existingUser) {
    const { clearOrphanedAppAccountForEmail } = await import('@/lib/auth/reconcile-orphan')
    const orphanCleanup = await clearOrphanedAppAccountForEmail(
      admin,
      normalizedEmail,
      existingUser.account_id,
    )

    if (orphanCleanup.error) {
      return {
        success: false,
        error: 'This email has leftover account data that could not be cleared. Contact support.',
      }
    }

    if (!orphanCleanup.cleared) {
      return {
        success: false,
        error: 'An account with this email already exists. Sign in instead.',
      }
    }
  }

  // 1) Create the Supabase auth user. email_confirm:true bypasses the
  //    verification email so the user can start onboarding immediately.
  const createResult = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, business_name: businessName },
  })

  if (createResult.error || !createResult.data.user) {
    const message = createResult.error?.message ?? 'Failed to create account'
    if (message.toLowerCase().includes('registered') || message.toLowerCase().includes('exists')) {
      return { success: false, error: 'An account with this email already exists. Sign in instead.' }
    }
    return { success: false, error: message }
  }

  const authUserId = createResult.data.user.id

  // 2) Allocate a unique slug for this business.
  const baseSlug = slugify(businessName)
  const slug = await findUniqueSlug(baseSlug)

  // 3) Insert the account. Onboarding_completed_at is deliberately left
  //    null — the user is dropped into /admin/onboarding so the wizard
  //    can capture their vertical, branding, voice, template, team, and
  //    integrations. Vertical defaults to 'agency' so the schema's NOT
  //    NULL constraint is satisfied; Step 1 of the wizard overwrites it.
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      slug,
      name: DEMO_WORKSPACE_NAME,
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

  // 4) Insert the owner user row — share the Supabase auth user id so the
  //    session userId always matches a row we can look up after signup.
  const { error: userError } = await admin.from('users').insert({
    id: authUserId,
    account_id: account.id,
    email: normalizedEmail,
    full_name: fullName,
    role: 'owner',
    is_active: true,
  })

  if (userError) {
    await admin.from('accounts').delete().eq('id', account.id)
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: userError.message }
  }

  // 5) Sign the user in via Supabase (sets Supabase's sb-* cookies) and then
  //    mint our own admin session cookie.
  const supabase = createSupabaseServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (signInError) {
    return { success: false, error: signInError.message }
  }

  await setAdminSession({
    type: 'admin',
    userId: authUserId,
    accountId: account.id,
    role: 'owner',
    email: normalizedEmail,
  })

  try {
    await seedSampleWorkspace(account.id)
  } catch (seedErr) {
    console.error('[signupAction] sample seed failed:', seedErr)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[signupAction] minted admin session', {
      accountId: account.id,
      userId: authUserId,
      email: normalizedEmail,
    })
  }

  // Always return redirectTo and let the client hard-navigate so the
  // Set-Cookie from setAdminSession() is committed before onboarding loads.
  return { success: true, data: { redirectTo: AUTH_ONBOARDING_PATH } }
}

/**
 * Finishes signup for a user who arrived via OAuth (Google / Facebook).
 *
 * At this point the Supabase Auth user already exists — the OAuth
 * callback set their session — but they don't have a Vantera account
 * yet. This action mirrors the same account-provisioning flow as
 * `signupAction` minus the password + Supabase user creation:
 *   - Create the account row (vertical=agency, onboarding incomplete)
 *   - Insert the owner users row
 *   - Mint the admin session cookie
 */
export async function completeOAuthSignupAction(
  input: z.infer<typeof completeOAuthSignupSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const validated = completeOAuthSignupSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message ?? 'Invalid signup details',
    }
  }

  const supabase = createSupabaseServerClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user || !userData.user.email) {
    return { success: false, error: 'Your sign-in session expired. Please try again.' }
  }

  const supaUser = userData.user
  const email = supaUser.email!.toLowerCase().trim()
  const { fullName, businessName } = validated.data

  const admin = getSupabaseAdmin()

  // Guard: if they already have a Vantera user, just sign them in. Route
  // to the wizard if their account hasn't completed onboarding yet (so a
  // user who started signup, bounced, and came back via OAuth still
  // resumes where they left off).
  //
  // ORDER BY created_at DESC: in the rare case where an email is tied to
  // multiple users rows (e.g. legacy test data), always pick the MOST
  // RECENT one. Without an explicit order, Postgres returns "some" row
  // and the user would silently land on an old account they thought was
  // gone.
  const { data: existingUser } = await admin
    .from('users')
    .select('id, account_id, role, email, created_at, is_active, full_name')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingUser?.account_id) {
    if (!existingUser.is_active) {
      await admin.from('users').update({ is_active: true }).eq('id', existingUser.id)
    }

    let linkedUserId = existingUser.id
    if (existingUser.id !== supaUser.id) {
      const { error: relinkErr } = await admin.from('users').upsert(
        {
          id: supaUser.id,
          account_id: existingUser.account_id,
          email,
          full_name: existingUser.full_name ?? fullName,
          role: existingUser.role ?? 'owner',
          is_active: true,
          deleted_at: null,
        },
        { onConflict: 'id' },
      )
      if (!relinkErr) {
        linkedUserId = supaUser.id
        await admin
          .from('users')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', existingUser.id)
      }
    }

    await setAdminSession({
      type: 'admin',
      userId: linkedUserId,
      accountId: existingUser.account_id,
      role: existingUser.role as UserRole,
      email: existingUser.email,
    })

    const { fetchAccountById } = await import('@/lib/onboarding/account-store')
    const account = await fetchAccountById(existingUser.account_id)
    const redirectTo =
      account && !isOnboardingComplete(account) ? AUTH_ONBOARDING_PATH : AUTH_DASHBOARD_PATH

    return {
      success: true,
      data: { redirectTo },
    }
  }

  const baseSlug = slugify(businessName)
  const slug = await findUniqueSlug(baseSlug)

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      slug,
      name: DEMO_WORKSPACE_NAME,
      vertical: 'agency',
      plan: 'team',
    })
    .select('id, slug')
    .single()

  if (accountError || !account) {
    return { success: false, error: accountError?.message ?? 'Failed to create workspace' }
  }

  const { error: userInsertErr } = await admin.from('users').insert({
    id: supaUser.id,
    account_id: account.id,
    email,
    full_name: fullName,
    role: 'owner',
    is_active: true,
  })

  if (userInsertErr) {
    await admin.from('accounts').delete().eq('id', account.id)
    return { success: false, error: userInsertErr.message }
  }

  await setAdminSession({
    type: 'admin',
    userId: supaUser.id,
    accountId: account.id,
    role: 'owner',
    email,
  })

  try {
    await seedSampleWorkspace(account.id)
  } catch (seedErr) {
    console.error('[completeOAuthSignupAction] sample seed failed:', seedErr)
  }

  return { success: true, data: { redirectTo: AUTH_ONBOARDING_PATH } }
}
