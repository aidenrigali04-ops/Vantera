import { env } from '@/lib/env'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@vantera/db'

type Database = PostgresJsDatabase<typeof schema>

let database: Database | undefined

function getDb(): Database {
  if (!database) {
    // Disable prefetch for connection pooling (Supabase requires this)
    const client = postgres(env.DATABASE_URL, { prepare: false })
    database = drizzle(client, { schema })
  }

  return database
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const target = getDb() as object
    const value = Reflect.get(target, prop, receiver)
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
  },
})

export type { Database }
