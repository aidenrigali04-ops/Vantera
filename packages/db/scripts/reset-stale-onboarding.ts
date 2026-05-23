// Reset onboarding for ALL accounts that were stamped onboarding_completed_at
// but have NO stage_definitions on them. Those are accounts that were created
// before the signup flow stopped pre-stamping the flag — the owner never
// actually went through the wizard, so their dashboard is empty.
//
// Usage:
//   pnpm db:reset-stale-onboarding
//
// Safe to re-run. Will only touch accounts whose stage_definitions table is
// empty for this account_id, so accounts that legitimately finished
// onboarding are untouched.

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })

async function main(): Promise<void> {
  const stale = await sql<{ id: string; name: string; email: string }[]>`
    SELECT a.id, a.name, COALESCE(u.email, '<no owner>') AS email
    FROM accounts a
    LEFT JOIN users u ON u.account_id = a.id AND u.role = 'owner' AND u.deleted_at IS NULL
    WHERE a.onboarding_completed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stage_definitions s WHERE s.account_id = a.id
      )
  `

  if (stale.length === 0) {
    console.log('No stale accounts found — every onboarded account has stages.')
    await sql.end()
    return
  }

  console.log(`Found ${stale.length} stale account(s):`)
  for (const row of stale) {
    console.log(`  - ${row.email} (${row.name}, ${row.id})`)
  }

  for (const account of stale) {
    await sql.begin(async (tx) => {
      await tx`UPDATE accounts
                SET onboarding_completed_at = NULL,
                    active_template_id = NULL,
                    updated_at = now()
                WHERE id = ${account.id}`
      await tx`DELETE FROM automations WHERE account_id = ${account.id}`
      await tx`DELETE FROM stage_definitions WHERE account_id = ${account.id}`
    })
  }

  console.log(`\n✓ Reset ${stale.length} account(s). Affected owners now route to /admin/onboarding.`)

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
