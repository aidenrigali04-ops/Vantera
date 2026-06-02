/**
 * Provision (or reset) a fixed demo owner account for the explore-first onboarding flow.
 *
 * Usage (from repo root):
 *   pnpm db:seed-demo-onboarding
 */
import { findAuthUserByEmail } from '@/lib/auth/reconcile-orphan'
import { DEMO_WORKSPACE_NAME } from '@/lib/onboarding/constants'
import { loadProjectEnv } from '@/lib/load-project-env'
import { seedSampleWorkspace } from '@/lib/sample-data/seed'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const DEMO_ONBOARDING_EMAIL = 'demo-onboarding@vantera.demo'
export const DEMO_ONBOARDING_PASSWORD = 'DemoVantera2026!'
export const DEMO_ONBOARDING_FULL_NAME = 'Demo Owner'
export const DEMO_ONBOARDING_BUSINESS_NAME = 'Acme Agency'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function findUniqueSlug(base: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const fallback = base || 'demo'
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

    candidate = `${fallback}-${Math.random().toString(36).slice(2, 6)}`
  }

  return `${fallback}-${Date.now().toString(36).slice(-6)}`
}

async function wipeExistingDemoAccount(email: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const normalized = email.toLowerCase().trim()

  const { data: existingUser } = await admin
    .from('users')
    .select('id, account_id')
    .eq('email', normalized)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (existingUser?.account_id) {
    const { error } = await admin.from('accounts').delete().eq('id', existingUser.account_id)
    if (error) {
      throw new Error(`Failed to delete existing account: ${error.message}`)
    }
    console.log(`  removed existing workspace ${existingUser.account_id}`)
  }

  const authUser = await findAuthUserByEmail(admin, normalized)
  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(authUser.id)
    if (error) {
      throw new Error(`Failed to delete existing auth user: ${error.message}`)
    }
    console.log(`  removed existing Supabase auth user ${normalized}`)
  }
}

async function main(): Promise<void> {
  loadProjectEnv()
  const admin = getSupabaseAdmin()
  const email = DEMO_ONBOARDING_EMAIL.toLowerCase().trim()

  console.log('Seeding demo onboarding account…')
  await wipeExistingDemoAccount(email)

  const createResult = await admin.auth.admin.createUser({
    email,
    password: DEMO_ONBOARDING_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: DEMO_ONBOARDING_FULL_NAME,
      business_name: DEMO_ONBOARDING_BUSINESS_NAME,
    },
  })

  if (createResult.error || !createResult.data.user) {
    throw new Error(createResult.error?.message ?? 'Failed to create Supabase auth user')
  }

  const authUserId = createResult.data.user.id
  const slug = await findUniqueSlug(slugify(DEMO_ONBOARDING_BUSINESS_NAME))

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .insert({
      slug,
      name: DEMO_WORKSPACE_NAME,
      vertical: 'agency',
      plan: 'team',
      onboarding_completed_at: null,
    })
    .select('id, slug')
    .single()

  if (accountError || !account) {
    await admin.auth.admin.deleteUser(authUserId)
    throw new Error(accountError?.message ?? 'Failed to create workspace')
  }

  const { error: userError } = await admin.from('users').insert({
    id: authUserId,
    account_id: account.id,
    email,
    full_name: DEMO_ONBOARDING_FULL_NAME,
    role: 'owner',
    is_active: true,
  })

  if (userError) {
    await admin.from('accounts').delete().eq('id', account.id)
    await admin.auth.admin.deleteUser(authUserId)
    throw new Error(userError.message)
  }

  await seedSampleWorkspace(account.id)

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `http://${appDomain}:3000`

  console.log('\n✓ Demo onboarding account ready.\n')
  console.log('  Email:    ', DEMO_ONBOARDING_EMAIL)
  console.log('  Password: ', DEMO_ONBOARDING_PASSWORD)
  console.log('  Role:      owner (admin)')
  console.log('  Workspace: ', DEMO_WORKSPACE_NAME)
  console.log('  Slug:      ', account.slug)
  console.log('  Account:   ', account.id)
  console.log('\n  Login:    ', `${appUrl}/?mode=login`)
  console.log('  Tenant:   ', `http://${account.slug}.${appDomain}:3000/admin/dashboard`)
  console.log('\n  Onboarding is incomplete — expect operating model modal, sample banner, and choice modal.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
