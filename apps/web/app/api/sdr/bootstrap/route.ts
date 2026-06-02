import { getAdminSession } from '@/lib/auth/session'
import { queueProspectScoutDiscovery } from '@/lib/prospect-scout/queue-discovery'
import {
  ensureProspectScoutActiveForDiscovery,
  ProspectScoutNotConfiguredError,
} from '@/lib/sdr/ensure-scout-active'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

/** Kick off Prospect Scout discovery after setup or from the command center. */
export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    await ensureProspectScoutActiveForDiscovery(session.accountId)
    const result = await queueProspectScoutDiscovery(session.accountId)
    return NextResponse.json({
      success: true,
      data: 'queued' in result ? { ...result, activated: true } : { ...result, activated: true },
    })
  } catch (error) {
    if (error instanceof ProspectScoutNotConfiguredError) {
      return NextResponse.json({ success: false, error: error.message, code: 'NOT_CONFIGURED' }, { status: 400 })
    }
    const message =
      error instanceof SdrNotEnabledError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Bootstrap run failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
