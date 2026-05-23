import { setAdminSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * OAuth + magic-link callback.
 *
 * Supabase redirects the user here with `?code=…` after a successful
 * OAuth handshake (or magic-link click). We:
 *
 *   1) Exchange the code for a Supabase session (sb-* cookies set
 *      via the SSR cookie adapter).
 *   2) Look up the authenticated user.
 *   3) If they already have a Vantera `users` row → mint our admin
 *      session cookie + redirect to /admin/dashboard.
 *   4) If they DON'T → redirect to /auth/complete-signup so they can
 *      pick a business name. We pass their pre-filled name/email
 *      through the URL so the form can be partially populated.
 *
 * Any failure here is fail-safe: send the user back to /auth/login with
 * a banner instead of a confusing blank screen.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  const next = url.searchParams.get('next') ?? '/admin/dashboard'

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorParam)}`, request.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_code', request.url))
  }

  const supabase = createSupabaseServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`, request.url),
    )
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return NextResponse.redirect(new URL('/auth/login?error=no_user', request.url))
  }

  const supaUser = userData.user
  const email = supaUser.email ?? ''

  if (!email) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_email', request.url))
  }

  // Look up an existing Vantera admin user with this email.
  const admin = getSupabaseAdmin()
  const { data: existingUserRow } = await admin
    .from('users')
    .select('id, account_id, role, email')
    .eq('email', email)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (existingUserRow?.account_id) {
    await setAdminSession({
      type: 'admin',
      userId: existingUserRow.id,
      accountId: existingUserRow.account_id,
      role: existingUserRow.role,
      email: existingUserRow.email,
    })

    return NextResponse.redirect(new URL(next, request.url))
  }

  // No Vantera account yet — push them through complete-signup.
  const fullName =
    (supaUser.user_metadata?.full_name as string | undefined) ??
    (supaUser.user_metadata?.name as string | undefined) ??
    ''

  const completeUrl = new URL('/auth/complete-signup', request.url)
  if (email) completeUrl.searchParams.set('email', email)
  if (fullName) completeUrl.searchParams.set('name', fullName)

  return NextResponse.redirect(completeUrl)
}
