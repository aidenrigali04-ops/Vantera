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
    const tables = await client<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const policies = await client<{ tablename: string; policyname: string; cmd: string }[]>`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `

    console.log('Table RLS state:')
    for (const t of tables) {
      const tablePolicies = policies.filter((p) => p.tablename === t.tablename)
      const tag = EXPECTED.includes(t.tablename) ? '' : '  [unexpected]'
      console.log(`  ${t.tablename.padEnd(30)} rls=${t.rowsecurity} policies=${tablePolicies.length}${tag}`)
      for (const p of tablePolicies) {
        console.log(`      • ${p.policyname} (${p.cmd})`)
      }
    }

    const present = new Set(tables.map((t) => t.tablename))
    const missing = EXPECTED.filter((t) => !present.has(t))
    if (missing.length) console.log(`\nMissing tables: ${missing.join(', ')}`)
    else console.log('\nAll expected tables present.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
