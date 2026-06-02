import { activateSdrModule } from '@/lib/sdr/activate-module'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await activateSdrModule()
  if (!result.success) {
    return NextResponse.json(result, { status: result.error === 'Unauthorized' ? 401 : 403 })
  }
  return NextResponse.json(result)
}
