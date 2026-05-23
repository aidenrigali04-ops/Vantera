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
  const email = (supaUser.email ?? '').toLowerCase().trim()

  if (!email) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_email', request.url))
  }

  // Look up an existing Vantera admin user with this email. ORDER BY
  // created_at DESC so a single email tied to multiple workspaces lands
  // on the MOST RECENT one — without explicit ordering Postgres returns
  // "some" row and the user silently ends up on an old account.
  const admin = getSupabaseAdmin()
  const { data: existingUserRow } = await admin
    .from('users')
    .select('id, account_id, role, email, created_at')
    .eq('email', email)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingUserRow?.account_id) {
    // Resolve where to land them. If onboarding still isn't complete and
    // they're the owner, drop them into the wizard rather than the
    // dashboard's empty state.
    const { data: existingAccount } = await admin
      .from('accounts')
      .select('onboarding_completed_at')
      .eq('id', existingUserRow.account_id)
      .maybeSingle()

    // setAdminSession overwrites any pre-existing v_admin_session via
    // Set-Cookie semantics — no separate clear is needed and emitting
    // both clear+set in the same response can race on some clients.
    await setAdminSession({
      type: 'admin',
      userId: existingUserRow.id,
      accountId: existingUserRow.account_id,
      role: existingUserRow.role,
      email: existingUserRow.email,
    })

    const needsOnboarding =
      !existingAccount?.onboarding_completed_at && existingUserRow.role === 'owner'

    // Respect an explicit `?next=` only if the user already finished onboarding.
    // Otherwise we don't want a stale dashboard deep-link to skip the wizard.
    const target = needsOnboarding ? '/admin/onboarding' : next
    return NextResponse.redirect(new URL(target, request.url))
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
