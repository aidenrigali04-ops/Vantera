import { getAdminSession } from '@/lib/auth/session'
import { runProspectScoutBootstrap } from '@/lib/prospect-scout/bootstrap'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { tasks } from '@trigger.dev/sdk'
import { NextResponse } from 'next/server'

/** Kick off Prospect Scout discovery after setup or from the command center. */
export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()

    try {
      await tasks.trigger('sdr-bootstrap-discovery', { accountId: session.accountId })
      return NextResponse.json({
        success: true,
        data: { queued: true, accountId: session.accountId },
      })
    } catch {
      const result = await runProspectScoutBootstrap(session.accountId)
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'SDR agent is not active' },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true, data: result })
    }
  } catch (error) {
    const message =
      error instanceof SdrNotEnabledError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Bootstrap run failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
