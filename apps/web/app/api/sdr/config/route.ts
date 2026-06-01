import { getAdminSession } from '@/lib/auth/session'
import {
  createSDRConfig,
  getSDRConfig,
  pauseSDRAgent,
  resumeSDRAgent,
  updateSDRConfig,
} from '@/lib/sdr/config'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import type { CreateSDRConfigInput } from '@/lib/sdr/types'
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
    const config = await getSDRConfig()
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    return errorResponse(error, 403)
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as CreateSDRConfigInput
    const result = await createSDRConfig(body)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error, 403)
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Partial<CreateSDRConfigInput>
    const result = await updateSDRConfig(body)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error, 403)
  }
}
