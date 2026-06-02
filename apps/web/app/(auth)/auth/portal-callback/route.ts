import { findAccountByPortalEmail, resolveAccountFromHost } from '@/lib/auth/resolve-account'
import { setPortalSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

function portalLoginRedirect(request: NextRequest, message: string) {
  const url = new URL('/auth/portal-login', request.url)
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

/**
 * Magic-link / invite callback for client portal users.
 * Exchanges the Supabase code, verifies portal access, and mints the portal session.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')

  if (errorParam) {
    return portalLoginRedirect(request, errorParam)
  }

  if (!code) {
    return portalLoginRedirect(request, 'Sign-in was interrupted. Please try again.')
  }

  const supabase = createSupabaseServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return portalLoginRedirect(request, exchangeError.message)
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user?.email) {
    return portalLoginRedirect(request, 'Could not verify your account. Try again.')
  }

  const email = userData.user.email.toLowerCase().trim()
  const host = request.headers.get('host') ?? ''

  let account = await resolveAccountFromHost(host)
  if (!account) {
    account = await findAccountByPortalEmail(email)
  }

  if (!account) {
    await supabase.auth.signOut()
    return portalLoginRedirect(request, 'Invalid email or password')
  }

  const admin = getSupabaseAdmin()
  const { data: contactRow, error: contactError } = await admin
    .from('contacts')
    .select('id, email, portal_access, deleted_at')
    .eq('account_id', account.id)
    .eq('email', email)
    .eq('portal_access', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contactError || !contactRow) {
    await supabase.auth.signOut()
    return portalLoginRedirect(request, 'Portal access is not enabled for this account.')
  }

  await admin
    .from('contacts')
    .update({ portal_last_login_at: new Date().toISOString() })
    .eq('id', contactRow.id)

  await setPortalSession({
    type: 'portal',
    contactId: contactRow.id,
    accountId: account.id,
    email: contactRow.email ?? email,
  })

  return NextResponse.redirect(new URL('/portal', request.url))
}
