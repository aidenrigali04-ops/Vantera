// Hard-wipe ALL Vantera workspaces + their Supabase auth users.
//
// Usage:
//   pnpm db:wipe-test-accounts
//
// Use BEFORE going to production. Deletes every account row, every user row,
// and the matching Supabase auth users so the next signup gets a truly clean
// slate. Idempotent. Will refuse to run if NODE_ENV=production (use a hard
// override env var if you really mean it).

import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.')
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

async function main(): Promise<void> {
  // Step 1: snapshot the emails we're about to remove from Supabase auth.
  const emails = await sql<{ email: string }[]>`
    SELECT DISTINCT email FROM users WHERE email IS NOT NULL
  `
  console.log(`Found ${emails.length} unique email(s) in users table.`)

  // Step 2: nuke every per-tenant row. Order matters — children before parents
  // to satisfy foreign keys.
  await sql.begin(async (tx) => {
    const tables = [
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
      'users',
      'accounts',
    ]
    for (const table of tables) {
      const deleted = await tx.unsafe(`DELETE FROM ${table} RETURNING 1`)
      console.log(`  cleared ${deleted.length} row(s) from ${table}`)
    }
  })

  // Step 3: clean up Supabase auth users. We list ALL auth users and delete
  // any whose email appeared in our wiped users table. (Listing is paginated
  // — keep going until the page is short.)
  let removed = 0
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

    const targetEmails = new Set(emails.map((e) => e.email.toLowerCase()))
    for (const u of batch) {
      if (!u.email) continue
      if (!targetEmails.has(u.email.toLowerCase())) continue

      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        console.warn(`  ! failed to delete auth user ${u.email}: ${delErr.message}`)
      } else {
        removed += 1
        console.log(`  removed auth user ${u.email}`)
      }
    }

    if (batch.length < perPage) break
    page += 1
  }

  console.log(`\n✓ Wipe complete. Removed ${removed} Supabase auth user(s).`)
  console.log('Every email is now free to signup again as a fresh account.')

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
