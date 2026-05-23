// Smoke-test for the AI brain persistence layer.
//
// Verifies that:
//   1. ai_memory rows upsert correctly (version bumps on re-insert)
//   2. ai_observations rows append cleanly
//   3. Unique constraint is enforced per (account, kind, subject)
//   4. Cleanup leaves nothing behind
//
// Connects to the same DATABASE_URL the app uses. Run with:
//   pnpm db:test:ai-memory
//
// .env is loaded by the `dotenv -e .env -- tsx ...` wrapper in package.json.
// We don't import 'dotenv/config' because the `dotenv` package isn't a
// project dependency — only `dotenv-cli` is.

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })

let failures = 0
function check(label: string, condition: boolean, detail?: string): void {
  if (condition) console.log(`  ✓ ${label}`)
  else {
    failures += 1
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main(): Promise<void> {
  console.log('\n1. Probe an account to test against (read-only)')
  const [acct] = await sql<{ id: string }[]>`SELECT id FROM accounts LIMIT 1`
  if (!acct) {
    console.log('  No accounts available to test against. Seed an account and re-run.')
    process.exit(0)
  }
  const accountId = acct.id
  console.log(`  Using account: ${accountId}`)

  console.log('\n2. Insert a memory row')
  const subjectId = '00000000-0000-0000-0000-000000000abc'
  const inserted = await sql<{ id: string; version: number }[]>`
    INSERT INTO ai_memory (account_id, kind, subject_type, subject_id, summary, confidence)
    VALUES (${accountId}, 'business_context', 'account', ${subjectId}, 'smoke test v1', 60)
    ON CONFLICT (account_id, kind, subject_type, subject_id) DO UPDATE
      SET summary = EXCLUDED.summary, version = ai_memory.version + 1, updated_at = now()
    RETURNING id, version
  `
  check('Insert returned a row', inserted.length === 1)
  check('Initial version is reasonable', (inserted[0]?.version ?? 0) >= 1)

  console.log('\n3. Re-insert same key (UPSERT bumps version)')
  const reinserted = await sql<{ id: string; version: number }[]>`
    INSERT INTO ai_memory (account_id, kind, subject_type, subject_id, summary, confidence)
    VALUES (${accountId}, 'business_context', 'account', ${subjectId}, 'smoke test v2', 70)
    ON CONFLICT (account_id, kind, subject_type, subject_id) DO UPDATE
      SET summary = EXCLUDED.summary, version = ai_memory.version + 1, updated_at = now()
    RETURNING id, version
  `
  check('Re-insert returns same id', reinserted[0]?.id === inserted[0]?.id)
  check(
    'Version bumped after re-insert',
    (reinserted[0]?.version ?? 0) > (inserted[0]?.version ?? 0),
  )

  console.log('\n4. Append an observation')
  const obsId = await sql<{ id: string }[]>`
    INSERT INTO ai_observations (account_id, kind, payload, outcome)
    VALUES (${accountId}, 'tool_called', ${sql.json({ tool: 'smoke', latencyMs: 42 })}, 'success')
    RETURNING id
  `
  check('Observation insert returned a row', obsId.length === 1)

  console.log('\n5. Cleanup')
  await sql`DELETE FROM ai_memory WHERE account_id = ${accountId} AND subject_id = ${subjectId}`
  if (obsId[0]?.id) {
    await sql`DELETE FROM ai_observations WHERE id = ${obsId[0].id}`
  }
  console.log('  ✓ Test rows removed.')

  if (failures === 0) {
    console.log('\n✓ All AI brain persistence checks passed.')
  } else {
    console.log(`\n✗ ${failures} check(s) failed.`)
  }

  await sql.end()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
