import { requireAdminSession } from '@/lib/auth/require-session'
import { createHostedAuthLink } from '@/lib/integrations/unipile/client'
import { saveUnipileConnection } from '@/lib/integrations/unipile/account'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * POST — generate a hosted-auth URL for the current user to connect their LinkedIn via Unipile.
 * Returns { url } which the client opens in a new tab/window.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminSession().catch(() => null)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const origin = req.nextUrl.origin

  try {
    const auth = await createHostedAuthLink({
      name: `${session.accountId}:${session.userId}`,
      successRedirectUrl: `${origin}/admin/outreach/linkedin?linkedin=connected`,
      failureRedirectUrl: `${origin}/admin/outreach/linkedin?linkedin=failed`,
      notifyUrl: `${origin}/api/webhooks/unipile`,
    })

    return NextResponse.json({ success: true, data: { url: auth.url, objectId: auth.object_id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create LinkedIn connect link'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * GET — callback after Unipile hosted auth completes.
 * Unipile sets ?account_id= on the success_redirect_url.
 * We also handle it here in case the client-side flow needs server confirmation.
 */
export async function GET(req: NextRequest) {
  const unipileAccountId = req.nextUrl.searchParams.get('account_id')
  const name = req.nextUrl.searchParams.get('name') // accountId:userId we sent

  if (!unipileAccountId || !name) {
    return NextResponse.redirect(
      new URL('/admin/outreach/linkedin?linkedin=failed', req.nextUrl.origin),
    )
  }

  const [accountId, userId] = name.split(':')
  if (!accountId || !userId) {
    return NextResponse.redirect(
      new URL('/admin/outreach/linkedin?linkedin=failed', req.nextUrl.origin),
    )
  }

  await saveUnipileConnection(accountId, userId, unipileAccountId)

  return NextResponse.redirect(
    new URL('/admin/outreach/linkedin?linkedin=connected', req.nextUrl.origin),
  )
}
