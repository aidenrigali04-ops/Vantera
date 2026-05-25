import { AuthLayout } from '@/components/shared/auth-layout'
import type { UserRole } from '@/lib/auth/constants'
import { setAdminSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompleteSignupClient } from './complete-signup-client'

export const dynamic = 'force-dynamic'

type Search = {
  email?: string
  name?: string
}

export default async function CompleteSignupPage({ searchParams }: { searchParams: Search }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    redirect('/auth/login?error=session_expired')
  }

  const email = user.email.toLowerCase().trim()
  const admin = getSupabaseAdmin()

  const { data: existingUser } = await admin
    .from('users')
    .select('id, account_id, role, email, is_active')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingUser?.account_id) {
    if (!existingUser.is_active) {
      await admin.from('users').update({ is_active: true }).eq('id', existingUser.id)
    }

    const { data: existingAccount } = await admin
      .from('accounts')
      .select('onboarding_completed_at')
      .eq('id', existingUser.account_id)
      .maybeSingle()

    await setAdminSession({
      type: 'admin',
      userId: existingUser.id,
      accountId: existingUser.account_id,
      role: existingUser.role as UserRole,
      email: existingUser.email,
    })

    const needsOnboarding =
      !existingAccount?.onboarding_completed_at && existingUser.role === 'owner'
    redirect(needsOnboarding ? '/admin/onboarding' : '/admin/dashboard')
  }

  const prefilledEmail = searchParams.email ?? email
  const prefilledName =
    searchParams.name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ''

  return (
    <AuthLayout>
      <CompleteSignupClient prefilledEmail={prefilledEmail} prefilledName={prefilledName} />
    </AuthLayout>
  )
}
