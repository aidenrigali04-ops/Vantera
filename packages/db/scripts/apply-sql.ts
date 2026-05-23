import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import postgres from 'postgres'

async function main(): Promise<void> {
  const file = process.argv[2]
  if (!file) {
    throw new Error('Usage: tsx packages/db/scripts/apply-sql.ts <relative-path-to-sql>')
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const sql = readFileSync(resolve(process.cwd(), file), 'utf8')
  const client = postgres(databaseUrl, { prepare: false, max: 1 })

  try {
    console.log(`Applying ${file}...`)
    await client.unsafe(sql)
    console.log(`✓ Applied ${file}`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
