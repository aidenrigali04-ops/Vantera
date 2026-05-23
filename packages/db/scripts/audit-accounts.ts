// Audit current account + user data to surface tenant-leak bugs.
//
// Usage:
//   pnpm db:audit-accounts
//
// Lists every account row with its owner users, slug, vertical, and
// onboarding_completed_at. Flags accounts with multiple owners (which
// is usually a sign that the signup flow incorrectly attached a new
// user to an existing account instead of provisioning a fresh one).

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })

async function main(): Promise<void> {
  const accounts = await sql<
    {
      id: string
      slug: string
      name: string
      vertical: string
      onboarding_completed_at: string | null
      created_at: string
    }[]
  >`
    SELECT id, slug, name, vertical, onboarding_completed_at, created_at
    FROM accounts
    ORDER BY created_at ASC
  `

  console.log(`\n=== ${accounts.length} account(s) ===\n`)

  for (const acc of accounts) {
    const owners = await sql<
      { id: string; email: string; full_name: string | null; created_at: string; is_active: boolean }[]
    >`
      SELECT id, email, full_name, created_at, is_active
      FROM users
      WHERE account_id = ${acc.id} AND deleted_at IS NULL
      ORDER BY created_at ASC
    `

    const stages = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM stage_definitions WHERE account_id = ${acc.id}
    `
    const stageCount = Number(stages[0]?.count ?? '0')

    console.log(`Account: ${acc.name}`)
    console.log(`  id=${acc.id} slug=${acc.slug} vertical=${acc.vertical}`)
    console.log(
      `  onboarded=${acc.onboarding_completed_at ? acc.onboarding_completed_at : 'NO'} stages=${stageCount}`,
    )
    console.log(`  users (${owners.length}):`)
    for (const u of owners) {
      const owner = u.full_name ? `${u.full_name} <${u.email}>` : u.email
      console.log(`    - ${owner}  [${u.id}]  active=${u.is_active}  created=${u.created_at}`)
    }

    if (owners.length > 1) {
      console.log('  ⚠️  MULTIPLE USERS on one account — possible tenant leak')
    }
    console.log()
  }

  // Reverse lookup: any email that maps to MULTIPLE accounts?
  const dupes = await sql<{ email: string; count: string; account_ids: string[] }[]>`
    SELECT email, COUNT(*)::text AS count, array_agg(account_id::text) AS account_ids
    FROM users
    WHERE deleted_at IS NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  `

  if (dupes.length > 0) {
    console.log('\n=== Emails attached to multiple accounts ===')
    for (const d of dupes) {
      console.log(`  ${d.email} -> ${d.count} accounts: ${d.account_ids.join(', ')}`)
    }
  } else {
    console.log('\nNo emails attached to multiple accounts.')
  }

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
