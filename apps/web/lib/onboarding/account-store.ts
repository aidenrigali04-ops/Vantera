import { getSupabaseAdmin } from '@/lib/supabase/admin'

type PatchResult = { ok: true } | { ok: false; message: string }

/**
 * Patch an account row via the Supabase service-role client — the same
 * transport signup uses. Avoids relying on DATABASE_URL / Drizzle in
 * Server Actions where the pooler URL may be missing or misconfigured on
 * Vercel even when SUPABASE_SERVICE_ROLE_KEY works.
 */
export async function patchAccountRow(
  accountId: string,
  patch: Record<string, string | number | null>,
): Promise<PatchResult> {
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('accounts')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }

  if (!data) {
    return { ok: false, message: 'Account not found' }
  }

  return { ok: true }
}
