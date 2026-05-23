import postgres from 'postgres'

const EXPECTED = [
  'accounts',
  'users',
  'contacts',
  'stage_definitions',
  'records',
  'activities',
  'automations',
  'automation_runs',
  'messages',
  'invoices',
  'documents',
  'intelligence_signals',
  'feature_flags',
  'integration_credentials',
  'vertical_templates',
]

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const client = postgres(databaseUrl, { prepare: false, max: 1 })
  try {
    const rows = await client<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const present = new Set(rows.map((r) => r.tablename))

    console.log('Tables in public schema:')
    for (const r of rows) {
      console.log(`  ${r.tablename.padEnd(30)} rls=${r.rowsecurity}`)
    }
    console.log('')

    const missing = EXPECTED.filter((t) => !present.has(t))
    const unexpected = rows.map((r) => r.tablename).filter((t) => !EXPECTED.includes(t))

    if (missing.length) console.log(`Missing expected tables: ${missing.join(', ')}`)
    if (unexpected.length) console.log(`Extra (non-schema) tables: ${unexpected.join(', ')}`)
    if (!missing.length && !unexpected.length) console.log('All expected tables present.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
