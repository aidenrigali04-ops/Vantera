/**
 * Grant all-access (admin + portal) to a single email on a tenant account.
 *
 * Uses ONLY the Supabase REST API + Admin Auth — no direct Postgres
 * connection — so this works even when DATABASE_URL points at a host
 * that hasn't been DNS-resolved yet (e.g. retired direct DB hosts on
 * newer Supabase projects).
 *
 * Run with:
 *   pnpm db:grant-access
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEST_ACCOUNT_SLUG       (optional; defaults to "testco")
 *   ALL_ACCESS_EMAIL        (optional; defaults to "aidenrigali04@gmail.com")
 *   ALL_ACCESS_PASSWORD     (optional; defaults to "Vantera2026!")
 *   ALL_ACCESS_FIRST_NAME   (optional; defaults to "Aiden")
 *   ALL_ACCESS_LAST_NAME    (optional; defaults to "Rigali")
 *   KEEP_ONBOARDING         (optional; "1" preserves onboarding_completed_at
 *                            instead of resetting it — set this when you want
 *                            to land directly on /admin/dashboard rather than
 *                            re-running the 5-step wizard)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const SLUG = process.env.TEST_ACCOUNT_SLUG ?? 'testco'
const EMAIL = process.env.ALL_ACCESS_EMAIL ?? 'aidenrigali04@gmail.com'
const PASSWORD = process.env.ALL_ACCESS_PASSWORD ?? 'Vantera2026!'
const FIRST_NAME = process.env.ALL_ACCESS_FIRST_NAME ?? 'Aiden'
const LAST_NAME = process.env.ALL_ACCESS_LAST_NAME ?? 'Rigali'
const FULL_NAME = `${FIRST_NAME} ${LAST_NAME}`

async function upsertAuthUser(admin: SupabaseClient, email: string, password: string): Promise<void> {
  const { data, error: listError } = await admin.auth.admin.listUsers()

  if (listError) {
    throw listError
  }

  const existing = data.users.find((u) => u.email === email)

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      throw error
    }

    console.log(`Created Supabase auth user ${email}`)
    return
  }

  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  })

  if (error) {
    throw error
  }

  console.log(`Reset password for Supabase auth user ${email}`)
}

async function getAccountIdBySlug(admin: SupabaseClient, slug: string): Promise<string> {
  const { data, error } = await admin
    .from('accounts')
    .select('id, onboarding_completed_at')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      `Account "${slug}" not found. Create it via your normal seed flow first, ` +
        `or set TEST_ACCOUNT_SLUG to an existing slug.`,
    )
  }

  // Default behavior: reset onboarding state so logging in walks the
  // owner through the 5-step wizard. Set KEEP_ONBOARDING=1 to leave the
  // account's onboarding_completed_at alone (useful when you want to
  // verify post-onboarding screens without re-running the wizard).
  if (process.env.KEEP_ONBOARDING === '1') {
    if (data.onboarding_completed_at) {
      console.log(`Kept onboarding_completed_at on "${slug}" (KEEP_ONBOARDING=1)`)
    }
    return data.id
  }

  if (data.onboarding_completed_at) {
    const { error: updateError } = await admin
      .from('accounts')
      .update({ onboarding_completed_at: null })
      .eq('id', data.id)

    if (updateError) {
      throw updateError
    }

    console.log(`Reset onboarding_completed_at on "${slug}" — wizard will run on next login`)
  } else {
    console.log(`Account "${slug}" already has onboarding incomplete — wizard will run on next login`)
  }

  return data.id
}

async function upsertAdminUserRow(admin: SupabaseClient, accountId: string): Promise<void> {
  const { data: existing, error: lookupError } = await admin
    .from('users')
    .select('id')
    .eq('account_id', accountId)
    .eq('email', EMAIL)
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    const { error } = await admin
      .from('users')
      .update({ role: 'owner', is_active: true, full_name: FULL_NAME, deleted_at: null })
      .eq('id', existing.id)

    if (error) {
      throw error
    }

    console.log(`Updated admin user ${EMAIL} (owner)`)
    return
  }

  const { error } = await admin.from('users').insert({
    account_id: accountId,
    email: EMAIL,
    full_name: FULL_NAME,
    role: 'owner',
    is_active: true,
  })

  if (error) {
    throw error
  }

  console.log(`Created admin user ${EMAIL} (owner)`)
}

async function upsertPortalContactRow(admin: SupabaseClient, accountId: string): Promise<void> {
  const { data: existing, error: lookupError } = await admin
    .from('contacts')
    .select('id')
    .eq('account_id', accountId)
    .eq('email', EMAIL)
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    const { error } = await admin
      .from('contacts')
      .update({
        portal_access: true,
        first_name: FIRST_NAME,
        last_name: LAST_NAME,
        deleted_at: null,
      })
      .eq('id', existing.id)

    if (error) {
      throw error
    }

    console.log(`Updated portal contact ${EMAIL}`)
    return
  }

  const { error } = await admin.from('contacts').insert({
    account_id: accountId,
    type: 'customer',
    first_name: FIRST_NAME,
    last_name: LAST_NAME,
    email: EMAIL,
    portal_access: true,
  })

  if (error) {
    throw error
  }

  console.log(`Created portal contact ${EMAIL}`)
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  })

  const accountId = await getAccountIdBySlug(admin, SLUG)
  console.log(`Found account "${SLUG}" (${accountId})`)

  await upsertAuthUser(admin, EMAIL, PASSWORD)
  await upsertAdminUserRow(admin, accountId)
  await upsertPortalContactRow(admin, accountId)

  console.log('\nAll-access credentials:')
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Tenant:   ${SLUG}`)
  const adminLanding =
    process.env.KEEP_ONBOARDING === '1' ? '/admin/dashboard' : '/admin/onboarding (wizard)'
  console.log(`  Admin:    /auth/login          → ${adminLanding}`)
  console.log(`  Portal:   /auth/portal-login   → /portal`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
