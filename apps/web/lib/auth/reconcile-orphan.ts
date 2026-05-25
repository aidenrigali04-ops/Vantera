import type { SupabaseClient } from '@supabase/supabase-js'

/** Paginate Supabase auth users until we find a matching email (admin API has no get-by-email). */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const normalized = email.toLowerCase().trim()
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || data.users.length === 0) return null

    const match = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (match?.email) return { id: match.id, email: match.email }

    if (data.users.length < 200) return null
    page += 1
  }
}

/**
 * When Supabase auth is deleted but public.users + accounts remain, signup is
 * blocked. Remove the orphaned workspace so the email can register again.
 */
export async function clearOrphanedAppAccountForEmail(
  admin: SupabaseClient,
  email: string,
  existingAccountId: string,
): Promise<{ cleared: boolean; error?: string }> {
  const authUser = await findAuthUserByEmail(admin, email)
  if (authUser) return { cleared: false }

  const { error } = await admin.from('accounts').delete().eq('id', existingAccountId)
  if (error) {
    return { cleared: false, error: error.message }
  }

  return { cleared: true }
}
