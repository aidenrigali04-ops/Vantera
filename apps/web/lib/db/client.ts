import { env } from '@/lib/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@vantera/db'

const connectionString = env.DATABASE_URL

// Disable prefetch for connection pooling (Supabase requires this)
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })

export type Database = typeof db
