// Quick diagnostic: which tables actually have RLS enabled in the live DB?
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, { prepare: false })

async function main(): Promise<void> {
  const rows = await sql<{ table_name: string; rls_enabled: boolean; policy_count: string }[]>`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = c.relname) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `

  console.log('Table'.padEnd(35) + 'RLS'.padEnd(8) + 'Policies')
  console.log('-'.repeat(55))
  for (const r of rows) {
    console.log(
      r.table_name.padEnd(35) +
        (r.rls_enabled ? 'ON' : 'OFF').padEnd(8) +
        r.policy_count,
    )
  }

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
