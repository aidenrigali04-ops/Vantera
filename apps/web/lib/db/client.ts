import { env } from '@/lib/env'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@vantera/db'

type Database = PostgresJsDatabase<typeof schema>

let database: Database | undefined

function getDb(): Database {
  if (!database) {
    // - prepare: false      → required for Supabase transaction-mode pooling
    // - connect_timeout: 5  → fail fast on bad DNS / unreachable host instead
    //                         of hanging the request until Vercel kills it
    // - idle_timeout: 20    → close idle connections in serverless environments
    // - max: 5              → smaller pool fits Vercel's serverless model
    const client = postgres(env.DATABASE_URL, {
      prepare: false,
      connect_timeout: 2,
      idle_timeout: 20,
      max: 5,
    })
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
