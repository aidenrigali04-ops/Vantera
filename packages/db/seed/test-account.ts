import { drizzle } from 'drizzle-orm/postgres-js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { and, eq } from 'drizzle-orm'
import postgres from 'postgres'
import ws from 'ws'

import { accounts, contacts, users } from '../schema.js'

const TEST_ACCOUNT_SLUG = 'testco'

const ADMIN_EMAIL = 'admin@testco.com'
const ADMIN_PASSWORD = 'TestcoAdmin123!'

const PORTAL_EMAIL = 'client@testco.com'
const PORTAL_PASSWORD = 'TestcoPortal123!'

// Personal all-access account — same Supabase Auth user maps to an
// `owner` row in `users` (admin) AND a `portalAccess` row in `contacts`
// (portal). One email + password unlocks both surfaces on `testco`.
const ALL_ACCESS_EMAIL = 'aidenrigali04@gmail.com'
const ALL_ACCESS_PASSWORD = 'Vantera2026!'

type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'technician' | 'agent'

async function upsertAuthUser(
  supabaseAdmin: SupabaseClient,
  existingAuthUsers: { id: string; email: string | undefined }[],
  email: string,
  password: string,
): Promise<void> {
  const found = existingAuthUsers.find((u) => u.email === email)

  if (!found) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
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

  const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
    password,
  })

  if (error) {
    throw error
  }

  console.log(`Reset password for Supabase auth user ${email}`)
}

async function upsertAdminUser(
  db: ReturnType<typeof drizzle>,
  accountId: string,
  email: string,
  fullName: string,
  role: Role,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.accountId, accountId)))
    .limit(1)

  if (!existing) {
    await db.insert(users).values({
      accountId,
      email,
      fullName,
      role,
      isActive: true,
    })
    console.log(`Created admin user ${email} (${role})`)
    return
  }

  await db
    .update(users)
    .set({ role, isActive: true, fullName })
    .where(eq(users.id, existing.id))
  console.log(`Updated admin user ${email} (${role})`)
}

async function upsertPortalContact(
  db: ReturnType<typeof drizzle>,
  accountId: string,
  email: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.email, email), eq(contacts.accountId, accountId)))
    .limit(1)

  if (!existing) {
    await db.insert(contacts).values({
      accountId,
      type: 'customer',
      firstName,
      lastName,
      email,
      portalAccess: true,
    })
    console.log(`Created portal contact ${email}`)
    return
  }

  await db
    .update(contacts)
    .set({ portalAccess: true, firstName, lastName })
    .where(eq(contacts.id, existing.id))
  console.log(`Updated portal contact ${email}`)
}

export async function seedTestAccount(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required',
    )
  }

  const client = postgres(databaseUrl, { prepare: false })
  const db = drizzle(client)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  })

  try {
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.slug, TEST_ACCOUNT_SLUG))
      .limit(1)

    let accountId: string

    if (existing[0]) {
      accountId = existing[0].id
      await db
        .update(accounts)
        .set({ onboardingCompletedAt: new Date() })
        .where(eq(accounts.id, accountId))
      console.log(
        `Account "${TEST_ACCOUNT_SLUG}" already exists (${accountId}) — onboarding marked complete`,
      )
    } else {
      const [account] = await db
        .insert(accounts)
        .values({
          slug: TEST_ACCOUNT_SLUG,
          name: 'Test Co HVAC',
          vertical: 'hvac',
          plan: 'team',
          brandPrimaryColor: '#1648A0',
          brandSecondaryColor: '#0D9488',
          onboardingCompletedAt: new Date(),
        })
        .returning({ id: accounts.id })

      accountId = account!.id
      console.log(`Created account "${TEST_ACCOUNT_SLUG}" (${accountId})`)
    }

    const { data: existingAuthUsersResult } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUsers = existingAuthUsersResult.users.map((u) => ({
      id: u.id,
      email: u.email,
    }))

    await upsertAuthUser(supabaseAdmin, existingAuthUsers, ADMIN_EMAIL, ADMIN_PASSWORD)
    await upsertAuthUser(supabaseAdmin, existingAuthUsers, PORTAL_EMAIL, PORTAL_PASSWORD)
    await upsertAuthUser(supabaseAdmin, existingAuthUsers, ALL_ACCESS_EMAIL, ALL_ACCESS_PASSWORD)

    await upsertAdminUser(db, accountId, ADMIN_EMAIL, 'Test Admin', 'owner')
    await upsertPortalContact(db, accountId, PORTAL_EMAIL, 'Test', 'Client')

    // All-access identity — owner-level admin AND portal contact on same account
    await upsertAdminUser(db, accountId, ALL_ACCESS_EMAIL, 'Aiden Rigali', 'owner')
    await upsertPortalContact(db, accountId, ALL_ACCESS_EMAIL, 'Aiden', 'Rigali')

    console.log('\nTest credentials:')
    console.log(`  Admin:      ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
    console.log(`  Portal:     ${PORTAL_EMAIL} / ${PORTAL_PASSWORD}`)
    console.log(`  All-access: ${ALL_ACCESS_EMAIL} / ${ALL_ACCESS_PASSWORD}`)
    console.log(`              (works for both /auth/login and /auth/portal-login)`)
    console.log(`  URL:        http://testco.lvh.me:3000/auth/login`)
  } finally {
    await client.end()
  }
}
