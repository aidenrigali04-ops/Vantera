// Wipe all Vantera workspaces + Supabase auth users EXCEPT one keeper email.
//
// Usage:
//   pnpm db:wipe-except focuscorelabel@gmail.com
//   KEEP_EMAIL=focuscorelabel@gmail.com pnpm db:wipe-except
//
// Removes orphaned app rows (users/accounts) left behind when Supabase auth
// users were deleted manually — the usual cause of "email already exists"
// on re-signup.

import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const keeperEmail = (process.argv[2] ?? process.env.KEEP_EMAIL ?? '').toLowerCase().trim()

if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.')
  process.exit(1)
}
if (!keeperEmail) {
  console.error('Usage: pnpm db:wipe-except <keeper-email>')
  console.error('   or: KEEP_EMAIL=<keeper-email> pnpm db:wipe-except')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_WIPE !== 'yes-i-am-sure') {
  console.error('Refusing to run with NODE_ENV=production. Set ALLOW_PROD_WIPE=yes-i-am-sure to override.')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as never },
})

const TENANT_TABLES = [
  'ai_observations',
  'ai_memory',
  'automation_runs',
  'automations',
  'intelligence_signals',
  'messages',
  'invoices',
  'documents',
  'activities',
  'records',
  'stage_definitions',
  'contacts',
  'integration_credentials',
  'feature_flags',
] as const

async function main(): Promise<void> {
  const keepers = await sql<{ id: string; account_id: string; email: string; full_name: string | null }[]>`
    SELECT id, account_id, email, full_name
    FROM users
    WHERE lower(email) = ${keeperEmail}
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  `

  if (keepers.length === 0) {
    console.error(`No active users row found for keeper email: ${keeperEmail}`)
    process.exit(1)
  }

  if (keepers.length > 1) {
    console.warn(`⚠️  ${keepers.length} users rows for ${keeperEmail} — keeping all linked accounts:`)
    for (const k of keepers) {
      console.warn(`    account_id=${k.account_id} user_id=${k.id}`)
    }
  }

  const keepAccountIds = [...new Set(keepers.map((k) => k.account_id))]
  const keeperLabel = keepers[0]?.full_name ?? keeperEmail

  console.log(`\nKeeping: ${keeperLabel} <${keeperEmail}>`)
  console.log(`Account id(s): ${keepAccountIds.join(', ')}\n`)

  const removedAccounts = await sql<{ id: string; slug: string; name: string }[]>`
    SELECT id, slug, name FROM accounts
    WHERE id <> ALL(${keepAccountIds}::uuid[])
    ORDER BY created_at ASC
  `

  console.log(`Removing ${removedAccounts.length} account(s):`)
  for (const acc of removedAccounts) {
    console.log(`  - ${acc.name} (${acc.slug}) [${acc.id}]`)
  }
  console.log()

  await sql.begin(async (tx) => {
    for (const table of TENANT_TABLES) {
      const deleted = await tx.unsafe(
        `DELETE FROM ${table} WHERE account_id <> ALL($1::uuid[]) RETURNING 1`,
        [keepAccountIds],
      )
      if (deleted.length > 0) {
        console.log(`  cleared ${deleted.length} row(s) from ${table}`)
      }
    }

    const deletedUsers = await tx`
      DELETE FROM users
      WHERE account_id <> ALL(${keepAccountIds}::uuid[])
      RETURNING email
    `
    console.log(`  cleared ${deletedUsers.length} row(s) from users`)

    const deletedAccounts = await tx`
      DELETE FROM accounts
      WHERE id <> ALL(${keepAccountIds}::uuid[])
      RETURNING slug
    `
    console.log(`  cleared ${deletedAccounts.length} row(s) from accounts`)
  })

  let removedAuth = 0
  let keptAuth = 0
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('listUsers failed:', error.message)
      break
    }
    const batch = data.users
    if (batch.length === 0) break

    for (const u of batch) {
      if (!u.email) continue
      if (u.email.toLowerCase() === keeperEmail) {
        keptAuth += 1
        console.log(`  kept auth user ${u.email}`)
        continue
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        console.warn(`  ! failed to delete auth user ${u.email}: ${delErr.message}`)
      } else {
        removedAuth += 1
        console.log(`  removed auth user ${u.email}`)
      }
    }

    if (batch.length < perPage) break
    page += 1
  }

  const remainingAccounts = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM accounts
  `
  const remainingUsers = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM users WHERE deleted_at IS NULL
  `

  console.log(`\n✓ Wipe complete.`)
  console.log(`  Supabase auth: kept ${keptAuth}, removed ${removedAuth}`)
  console.log(`  App DB: ${remainingAccounts[0]?.count ?? '?'} account(s), ${remainingUsers[0]?.count ?? '?'} user(s) remaining`)
  console.log(`\n${keeperEmail} can sign in. All other emails are free to signup again.`)

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
