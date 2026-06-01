import { resumeSDRAgent } from '@/lib/sdr/config'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const result = await resumeSDRAgent()
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    const message = error instanceof SdrNotEnabledError ? error.message : 'Request failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
