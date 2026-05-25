/**
 * One-shot Postgres queries for critical writes when Supabase JS / PostgREST
 * fail on Vercel serverless (ws init, pooler quirks, etc.).
 */

import { env } from '@/lib/env'
import postgres from 'postgres'

function getDirectConnectionUrl(): string {
  return env.DIRECT_URL ?? env.DATABASE_URL
}

export async function markAccountOnboardingCompleteViaSql(
  accountId: string,
  timestamp: string,
): Promise<boolean> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return false

  const sql = postgres(getDirectConnectionUrl(), {
    prepare: false,
    max: 1,
    connect_timeout: 5,
  })

  try {
    const rows = await sql<{ id: string; onboarding_completed_at: string | null }[]>`
      UPDATE accounts
      SET onboarding_completed_at = ${timestamp}::timestamptz,
          updated_at = NOW()
      WHERE id = ${normalizedId}::uuid
      RETURNING id, onboarding_completed_at
    `

    return rows.length > 0 && Boolean(rows[0]?.onboarding_completed_at)
  } finally {
    await sql.end({ timeout: 2 })
  }
}

export async function isAccountOnboardingCompleteViaSql(accountId: string): Promise<boolean | null> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return null

  const sql = postgres(getDirectConnectionUrl(), {
    prepare: false,
    max: 1,
    connect_timeout: 5,
  })

  try {
    const rows = await sql<{ onboarding_completed_at: string | null }[]>`
      SELECT onboarding_completed_at
      FROM accounts
      WHERE id = ${normalizedId}::uuid
      LIMIT 1
    `

    if (rows.length === 0) return null
    return Boolean(rows[0]?.onboarding_completed_at)
  } finally {
    await sql.end({ timeout: 2 })
  }
}

export async function lookupUserAccountIdViaSql(userId: string): Promise<string | null> {
  const normalizedUserId = String(userId).trim()
  if (!normalizedUserId) return null

  const sql = postgres(getDirectConnectionUrl(), {
    prepare: false,
    max: 1,
    connect_timeout: 5,
  })

  try {
    const rows = await sql<{ account_id: string }[]>`
      SELECT account_id
      FROM users
      WHERE id = ${normalizedUserId}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `

    const accountId = rows[0]?.account_id
    return accountId ? String(accountId).trim() : null
  } finally {
    await sql.end({ timeout: 2 })
  }
}

export async function accountExistsViaSql(accountId: string): Promise<boolean> {
  const normalizedId = String(accountId).trim()
  if (!normalizedId) return false

  const sql = postgres(getDirectConnectionUrl(), {
    prepare: false,
    max: 1,
    connect_timeout: 5,
  })

  try {
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM accounts
      WHERE id = ${normalizedId}::uuid
      LIMIT 1
    `

    return rows.length > 0
  } finally {
    await sql.end({ timeout: 2 })
  }
}
