'use server'

import {
  findAccountByAdminEmail,
  findAccountByPortalEmail,
  resolveAccountFromHost,
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
import { seedSampleWorkspace } from '@/lib/sample-data/seed'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const signupSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name').max(120),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(120),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

  const host = headers().get('host') ?? ''

  // First try to resolve via the host (tenant subdomain or portal_domain).
  // Fall back to looking up the account by the admin user's email — this
  // is what lets users sign in from the marketing apex, the bare
  // *.vercel.app URL, or localhost without needing a TEST_TENANT_SLUG.
  let account = await resolveAccountFromHost(host)
  if (!account) {
    account = await findAccountByAdminEmail(validated.data.email)
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

  // Owners land on the demo dashboard to explore before completing setup.
  const redirectTo = '/admin/dashboard'

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
        error: 'An account with this email already exists. Try signing in.',
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
      return { success: false, error: 'An account with this email already exists. Try signing in.' }
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
  // Set-Cookie from setAdminSession() is committed before /admin/onboarding
  // loads. redirect() in the same Server Action races on Vercel — the next
  // request sometimes arrives without v_admin_session.
  return { success: true, data: { redirectTo: '/admin/dashboard' } }
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
    .select('id, account_id, role, email, created_at, is_active')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingUser?.account_id) {
    if (!existingUser.is_active) {
      await admin.from('users').update({ is_active: true }).eq('id', existingUser.id)
    }

    const { data: existingAccount } = await admin
      .from('accounts')
      .select('onboarding_completed_at')
      .eq('id', existingUser.account_id)
      .maybeSingle()

    await setAdminSession({
      type: 'admin',
      userId: existingUser.id,
      accountId: existingUser.account_id,
      role: existingUser.role as UserRole,
      email: existingUser.email,
    })

    return {
      success: true,
      data: { redirectTo: '/admin/dashboard' },
    }
  }

  const baseSlug = slugify(businessName)
  const slug = await findUniqueSlug(baseSlug)

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

  return { success: true, data: { redirectTo: '/admin/dashboard' } }
}
