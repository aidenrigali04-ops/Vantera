// Reset onboarding for an account by owner email.
//
// Usage:
//   pnpm db:reset-onboarding aidenrigali03@gmail.com
//
// Clears `accounts.onboarding_completed_at` AND `accounts.active_template_id`
// so the owner is routed back through the wizard the next time they hit
// `/admin/*`. Also clears the existing `automations` and `stage_definitions`
// for that account so the wizard's "Apply template" step starts from a clean
// slate (no stale rows from a prior demo seed).
//
// Safe to re-run. Cleans up its own connection.

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const targetEmail = process.argv[2]
if (!targetEmail) {
  console.error('Usage: pnpm db:reset-onboarding <owner-email>')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })

async function main(): Promise<void> {
  const owner = await sql<{ id: string; account_id: string; email: string }[]>`
    SELECT id, account_id, email FROM users
    WHERE email = ${targetEmail} AND role = 'owner' AND deleted_at IS NULL
    LIMIT 1
  `

  if (owner.length === 0) {
    console.error(`No owner user found with email ${targetEmail}.`)
    process.exit(1)
  }

  const accountId = owner[0]!.account_id
  console.log(`Resetting account ${accountId} (owner: ${targetEmail})…`)

  await sql.begin(async (tx) => {
    await tx`UPDATE accounts
              SET onboarding_completed_at = NULL,
                  active_template_id = NULL,
                  updated_at = now()
              WHERE id = ${accountId}`

    const deletedAutomations = await tx`
      DELETE FROM automations WHERE account_id = ${accountId} RETURNING id
    `
    const deletedStages = await tx`
      DELETE FROM stage_definitions WHERE account_id = ${accountId} RETURNING id
    `
    console.log(`  cleared ${deletedAutomations.length} automations`)
    console.log(`  cleared ${deletedStages.length} stage definitions`)
  })

  console.log('\n✓ Onboarding reset. Refresh the browser and you should be routed to /admin/onboarding.')

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
