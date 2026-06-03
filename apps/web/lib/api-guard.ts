import { getSyncedAdminSession } from '@/lib/auth/require-session'
import type { AdminSession } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { FlagName, Plan } from '@/lib/feature-flags/flags'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/**
 * API route guard utilities.
 * accountId always comes from the verified admin session — never from the request body.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function requireAccount(): Promise<{ accountId: string; userId: string; session: AdminSession }> {
  const session = await getSyncedAdminSession()

  if (!session) {
    throw new ApiError(401, 'Unauthorized')
  }

  return {
    accountId: session.accountId,
    userId: session.userId,
    session,
  }
}

/** Service-role Supabase client — server-only; bypasses RLS. */
export function getServiceClient() {
  return getSupabaseAdmin()
}

async function resolveAccountPlan(accountId: string): Promise<Plan> {
  const [row] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return row?.plan === 'enterprise' ? 'enterprise' : 'team'
}

export async function isFeatureEnabled(accountId: string, flagName: FlagName): Promise<boolean> {
  const plan = await resolveAccountPlan(accountId)
  return evaluateFlag({ accountId, plan, flagName })
}

/** Gate autonomous AI sends — uses the account SDR Automatic outreach toggle. */
export async function assertAIMessagingEnabled(accountId: string): Promise<void> {
  const { isAccountAutomaticOutreach } = await import('@/lib/sdr/outreach-automation-policy')
  const enabled = await isAccountAutomaticOutreach(accountId)
  if (!enabled) {
    throw new ApiError(
      403,
      'Automatic outreach is off. Approve drafts in Message Drafter or enable Automatic outreach in Prospect Scout.',
    )
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }

  console.error('[API Error]', error)
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
}

/** Soft-delete via service role (sets deleted_at). */
export async function softDelete(
  table: string,
  id: string,
  accountId: string,
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)

  if (error) {
    throw new ApiError(500, `Failed to delete: ${error.message}`)
  }
}
