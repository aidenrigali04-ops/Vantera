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

// `*.vercel.app` only has a one-level wildcard SSL cert. A two-deep host
// like `<slug>.vantera-web.vercel.app` is unreachable over HTTPS, so when
// the app domain is Vercel-managed we must NOT redirect to a tenant
// subdomain — we stay on the same host and resolve the tenant by session.
function isVercelManagedDomain(appDomain: string): boolean {
  const normalized = appDomain.startsWith('.') ? appDomain.slice(1) : appDomain
  return normalized === 'vercel.app' || normalized.endsWith('.vercel.app')
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

  // 1) Create the Supabase auth user. email_confirm:true bypasses the
  //    verification email so the user can start onboarding immediately.
  const createResult = await admin.auth.admin.createUser({
    email,
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

  // 3) Insert the account. We mark onboarding_completed_at immediately
  //    because the new flow drops users straight into a demo-data
  //    workspace — no wizard gate. Vertical defaults to 'agency' to
  //    match the sample content; the user can change it later from
  //    settings.
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      slug,
      name: businessName,
      vertical: 'agency',
      plan: 'team',
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single()

  if (accountError || !account) {
    // Roll back the auth user so the email can be reused on retry.
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: accountError?.message ?? 'Failed to create workspace' }
  }

  // 4) Insert the owner user row.
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

  // 5b) Seed sample agency-style content (3 clients, 5 deals, 2 projects
  //     + pipeline stages). Best-effort — signup must still succeed even
  //     if seeding hiccups, because the user can always start fresh.
  try {
    await seedSampleWorkspace(account.id)
  } catch (err) {
    console.error('[signup] sample data seed failed:', err)
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
  //    - If we're on a real configured app domain that has wildcard SSL
  //      (e.g. vantera.app with *.vantera.app DNS), jump to
  //      <slug>.<appDomain>/admin/dashboard so the URL bar reflects the
  //      new workspace. The session cookie's `.appDomain` scope keeps the
  //      user signed in across the subdomain hop.
  //    - On *.vercel.app, localhost, lvh.me, Vercel preview URLs, etc.,
  //      stay on the current host. *.vercel.app only has a single-level
  //      wildcard cert so sub-subdomains aren't reachable over HTTPS.
  //      The middleware/resolve-account session-cookie fallback then
  //      resolves the right tenant from the freshly-set admin session.
  const host = headers().get('host') ?? ''
  const hostname = host.split(':')[0] ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''

  const supportsTenantSubdomains = Boolean(appDomain) && !isVercelManagedDomain(appDomain)
  const onAppDomain = Boolean(
    appDomain && (hostname === appDomain || hostname.endsWith(`.${appDomain}`)),
  )
  const onCorrectSubdomain = Boolean(appDomain && hostname === `${account.slug}.${appDomain}`)

  if (supportsTenantSubdomains && onAppDomain && !onCorrectSubdomain) {
    const target = `https://${account.slug}.${appDomain}/admin/dashboard`
    return { success: true, data: { redirectTo: target } }
  }

  return { success: true, data: { redirectTo: '/admin/dashboard' } }
}

/**
 * Finishes signup for a user who arrived via OAuth (Google / Facebook).
 *
 * At this point the Supabase Auth user already exists — the OAuth
 * callback set their session — but they don't have a Vantera account
 * yet. This action mirrors the same account-provisioning flow as
 * `signupAction` minus the password + Supabase user creation:
 *   - Create the account row (vertical=agency, onboarding complete)
 *   - Insert the owner users row
 *   - Seed sample data
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
  const email = supaUser.email!
  const { fullName, businessName } = validated.data

  const admin = getSupabaseAdmin()

  // Guard: if they already have a Vantera user, just sign them in.
  const { data: existingUser } = await admin
    .from('users')
    .select('id, account_id, role, email')
    .eq('email', email)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (existingUser?.account_id) {
    await setAdminSession({
      type: 'admin',
      userId: existingUser.id,
      accountId: existingUser.account_id,
      role: existingUser.role as UserRole,
      email: existingUser.email,
    })
    return { success: true, data: { redirectTo: '/admin/dashboard' } }
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
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single()

  if (accountError || !account) {
    return { success: false, error: accountError?.message ?? 'Failed to create workspace' }
  }

  const { error: userInsertErr } = await admin.from('users').insert({
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

  try {
    await seedSampleWorkspace(account.id)
  } catch (err) {
    console.error('[complete-oauth-signup] sample seed failed:', err)
  }

  await setAdminSession({
    type: 'admin',
    userId: userRow.id,
    accountId: account.id,
    role: 'owner',
    email,
  })

  const host = headers().get('host') ?? ''
  const hostname = host.split(':')[0] ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''

  const supportsTenantSubdomains = Boolean(appDomain) && !isVercelManagedDomain(appDomain)
  const onAppDomain = Boolean(
    appDomain && (hostname === appDomain || hostname.endsWith(`.${appDomain}`)),
  )
  const onCorrectSubdomain = Boolean(appDomain && hostname === `${account.slug}.${appDomain}`)

  if (supportsTenantSubdomains && onAppDomain && !onCorrectSubdomain) {
    return {
      success: true,
      data: { redirectTo: `https://${account.slug}.${appDomain}/admin/dashboard` },
    }
  }

  return { success: true, data: { redirectTo: '/admin/dashboard' } }
}
