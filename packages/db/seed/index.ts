import { accounts, contacts, users } from '../schema.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'

const TEST_ACCOUNT_SLUG = 'testco'
const ADMIN_EMAIL = 'admin@testco.com'
const ADMIN_PASSWORD = 'TestcoAdmin123!'
const PORTAL_EMAIL = 'client@testco.com'
const PORTAL_PASSWORD = 'TestcoPortal123!'

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
    throw new Error('DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const client = postgres(databaseUrl, { prepare: false })
  const db = drizzle(client)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const existing = await db.select().from(accounts).where(eq(accounts.slug, TEST_ACCOUNT_SLUG)).limit(1)

  let accountId: string

  if (existing[0]) {
    accountId = existing[0].id
    console.log(`Account "${TEST_ACCOUNT_SLUG}" already exists (${accountId})`)
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
      })
      .returning({ id: accounts.id })

    accountId = account!.id
    console.log(`Created account "${TEST_ACCOUNT_SLUG}" (${accountId})`)
  }

  const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
  const adminAuthUser = existingAuthUsers.users.find((u) => u.email === ADMIN_EMAIL)

  if (!adminAuthUser) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })

    if (error) {
      throw error
    }

    console.log(`Created Supabase auth user ${ADMIN_EMAIL}`)
  } else {
    console.log(`Supabase auth user ${ADMIN_EMAIL} already exists`)
  }

  const portalAuthUser = existingAuthUsers.users.find((u) => u.email === PORTAL_EMAIL)

  if (!portalAuthUser) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: PORTAL_EMAIL,
      password: PORTAL_PASSWORD,
      email_confirm: true,
    })

    if (error) {
      throw error
    }

    console.log(`Created Supabase auth user ${PORTAL_EMAIL}`)
  } else {
    console.log(`Supabase auth user ${PORTAL_EMAIL} already exists`)
  }

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1)

  if (!existingUsers[0]) {
    await db.insert(users).values({
      accountId,
      email: ADMIN_EMAIL,
      fullName: 'Test Admin',
      role: 'owner',
    })
    console.log(`Created admin user ${ADMIN_EMAIL}`)
  } else {
    console.log(`Admin user ${ADMIN_EMAIL} already exists`)
  }

  const existingContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, PORTAL_EMAIL))
    .limit(1)

  if (!existingContacts[0]) {
    await db.insert(contacts).values({
      accountId,
      type: 'customer',
      firstName: 'Test',
      lastName: 'Client',
      email: PORTAL_EMAIL,
      portalAccess: true,
    })
    console.log(`Created portal contact ${PORTAL_EMAIL}`)
  } else {
    console.log(`Portal contact ${PORTAL_EMAIL} already exists`)
  }

  console.log('\nTest credentials:')
  console.log(`  Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`  Portal: ${PORTAL_EMAIL} / ${PORTAL_PASSWORD}`)
  console.log(`  URL:    http://testco.lvh.me:3000/auth/login`)

  await client.end()
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
