import type { AdminSession } from '@/lib/auth/types'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import slugify from 'slugify'

/**
 * Create a missing accounts + users linkage for an authenticated owner who
 * reached onboarding without a Vantera users row (partial signup failure).
 */
export async function provisionOwnerWorkspace(session: AdminSession): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin()

    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(session.userId)
    if (authErr || !authData.user) {
      console.error('[provisionOwnerWorkspace] auth user missing', authErr?.message)
      return null
    }

    const meta = authData.user.user_metadata ?? {}
    const businessName =
      (typeof meta.business_name === 'string' && meta.business_name.trim()) ||
      session.email.split('@')[0] ||
      'Workspace'
    const fullName =
      (typeof meta.full_name === 'string' && meta.full_name.trim()) || businessName

    const baseSlug = slugify(businessName, { lower: true, strict: true, trim: true }) || 'workspace'
    let slug = baseSlug.slice(0, 60)
    let suffix = 0

    while (suffix < 20) {
      const candidate = suffix === 0 ? slug : `${slug.slice(0, 55)}-${suffix}`
      const { data: existing } = await admin.from('accounts').select('id').eq('slug', candidate).maybeSingle()
      if (!existing) {
        slug = candidate
        break
      }
      suffix += 1
    }

    const { data: account, error: accountError } = await admin
      .from('accounts')
      .insert({
        slug,
        name: businessName,
        vertical: 'agency',
        plan: 'team',
      })
      .select('id')
      .single()

    if (accountError || !account?.id) {
      console.error('[provisionOwnerWorkspace] account insert failed', accountError?.message)
      return null
    }

    const accountId = String(account.id)

    const { error: userError } = await admin.from('users').upsert(
      {
        id: session.userId,
        account_id: accountId,
        email: session.email.toLowerCase().trim(),
        full_name: fullName,
        role: 'owner',
        is_active: true,
        deleted_at: null,
      },
      { onConflict: 'id' },
    )

    if (userError) {
      console.error('[provisionOwnerWorkspace] users upsert failed', userError.message)
      await admin.from('accounts').delete().eq('id', accountId)
      return null
    }

    console.warn('[provisionOwnerWorkspace] provisioned missing workspace', {
      userId: session.userId,
      accountId,
    })

    return accountId
  } catch (err) {
    console.error('[provisionOwnerWorkspace] threw', err)
    return null
  }
}
