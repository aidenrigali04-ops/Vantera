import { setAdminSession } from '@/lib/auth/session'
import {
  AUTH_DASHBOARD_PATH,
  AUTH_LOGIN_PATH,
  AUTH_ONBOARDING_PATH,
  AUTH_SIGNUP_PATH,
} from '@/lib/auth/routes'
import { fetchAccountById } from '@/lib/onboarding/account-store'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

function safeReturnPath(raw: string | null): string {
  if (!raw) return AUTH_LOGIN_PATH
  if (!raw.startsWith('/auth/')) return AUTH_LOGIN_PATH
  if (raw.includes('://')) return AUTH_LOGIN_PATH
  return raw
}

function authErrorRedirect(request: NextRequest, returnTo: string, message: string) {
  const url = new URL(returnTo, request.url)
  url.searchParams.set('error', message)
  url.searchParams.set('oauth', '1')
  return NextResponse.redirect(url)
}

/**
 * OAuth + magic-link callback.
 *
 * Supabase redirects here with `?code=…` after OAuth. We exchange the code,
 * mint the admin session for existing users, or send new users to complete-signup.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  const returnTo = safeReturnPath(url.searchParams.get('return_to'))
  const next = url.searchParams.get('next') ?? AUTH_DASHBOARD_PATH

  if (errorParam) {
    return authErrorRedirect(request, returnTo, errorParam)
  }

  if (!code) {
    return authErrorRedirect(request, returnTo, 'Sign-in was interrupted. Please try again.')
  }

  const supabase = createSupabaseServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return authErrorRedirect(request, returnTo, exchangeError.message)
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return authErrorRedirect(request, returnTo, 'Could not verify your account. Try again.')
  }

  const supaUser = userData.user
  const email = (supaUser.email ?? '').toLowerCase().trim()

  if (!email) {
    return authErrorRedirect(request, returnTo, 'Your account is missing an email address.')
  }

  const admin = getSupabaseAdmin()
  const { data: existingUserRow } = await admin
    .from('users')
    .select('id, account_id, role, email, created_at, is_active')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingUserRow?.account_id) {
    if (!existingUserRow.is_active) {
      await admin.from('users').update({ is_active: true }).eq('id', existingUserRow.id)
    }

    let linkedUserId = existingUserRow.id
    if (existingUserRow.id !== supaUser.id) {
      const { error: relinkErr } = await admin.from('users').upsert(
        {
          id: supaUser.id,
          account_id: existingUserRow.account_id,
          email,
          role: existingUserRow.role ?? 'owner',
          is_active: true,
          deleted_at: null,
        },
        { onConflict: 'id' },
      )
      if (!relinkErr) {
        linkedUserId = supaUser.id
        await admin
          .from('users')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', existingUserRow.id)
      }
    }

    await setAdminSession({
      type: 'admin',
      userId: linkedUserId,
      accountId: existingUserRow.account_id,
      role: existingUserRow.role,
      email: existingUserRow.email,
    })

    const account = await fetchAccountById(existingUserRow.account_id)
    const destination =
      account && !account.onboarding_completed_at ? AUTH_ONBOARDING_PATH : next

    return NextResponse.redirect(new URL(destination, request.url))
  }

  const fullName =
    (supaUser.user_metadata?.full_name as string | undefined) ??
    (supaUser.user_metadata?.name as string | undefined) ??
    ''

  const completeUrl = new URL('/auth/complete-signup', request.url)
  completeUrl.searchParams.set('email', email)
  if (fullName) completeUrl.searchParams.set('name', fullName)
  completeUrl.searchParams.set('return_to', returnTo === AUTH_LOGIN_PATH ? AUTH_SIGNUP_PATH : returnTo)

  return NextResponse.redirect(completeUrl)
}
