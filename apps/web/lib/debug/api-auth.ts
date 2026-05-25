import { ADMIN_SESSION_COOKIE } from '@/lib/auth/constants'
import { signSessionToken } from '@/lib/auth/jwt'
import type { AdminSession } from '@/lib/auth/types'
import { getDebugTestConfig } from './config'
import { getAdminSql } from './utils'

type DebugUserRow = {
  id: string
  account_id: string
  email: string
  role: AdminSession['role']
}

/** Resolve an owner/admin user for Larry HTTP smoke tests (cookie auth). */
export async function resolveDebugAdminSession(): Promise<AdminSession | null> {
  const cfg = getDebugTestConfig()
  const sql = getAdminSql()

  const rows = cfg.testAccountIdTeam
    ? await sql<DebugUserRow[]>`
        SELECT id, account_id, email, role
        FROM users
        WHERE account_id = ${cfg.testAccountIdTeam}::uuid
          AND deleted_at IS NULL
          AND is_active = true
        ORDER BY CASE role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'manager' THEN 3
          ELSE 4
        END
        LIMIT 1
      `
    : await sql<DebugUserRow[]>`
        SELECT id, account_id, email, role
        FROM users
        WHERE deleted_at IS NULL
          AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      `

  const row = rows[0]
  if (!row) return null

  return {
    type: 'admin',
    userId: row.id,
    accountId: row.account_id,
    role: row.role,
    email: row.email,
  }
}

/** Cookie header for authenticated /api/* smoke tests. */
export async function buildDebugAuthHeaders(): Promise<Record<string, string> | null> {
  const session = await resolveDebugAdminSession()
  if (!session) return null

  const token = await signSessionToken(session)
  return {
    Cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
  }
}
