import { type NextRequest, NextResponse } from 'next/server'

/**
 * Legacy Supabase magic-link callback — portal auth no longer uses Supabase.
 */
export async function GET(request: NextRequest) {
  const url = new URL('/auth/portal-login', request.url)
  url.searchParams.set(
    'error',
    'Portal sign-in has been updated. Open your latest portal invite email and use the link to create your client portal password, then sign in with that password.',
  )
  return NextResponse.redirect(url)
}
