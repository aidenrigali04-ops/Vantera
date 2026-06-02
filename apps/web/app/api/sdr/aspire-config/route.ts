import { getAdminSession } from '@/lib/auth/session'
import { getSdrAspireConfig, saveSdrAspireConfig } from '@/lib/sdr/aspire-config'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import type { ProspectMode } from '@/lib/prospect-scout/types'
import type { ICPConfig } from '@/lib/aspire/types'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import { NextResponse } from 'next/server'

function errorResponse(error: unknown, status = 400) {
  const message = error instanceof SdrNotEnabledError ? error.message : 'Request failed'
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const data = await getSdrAspireConfig(session.accountId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return errorResponse(error, 403)
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const body = (await request.json()) as {
      prospectMode?: ProspectMode
      defaultMinIcpScore?: number
      syncIcpToSavedSearches?: boolean
      icpConfig?: ICPConfig
      bindings?: AspireBindingInput[]
    }

    const data = await saveSdrAspireConfig(session.accountId, body)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
