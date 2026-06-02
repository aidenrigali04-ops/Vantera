import { findProspectScoutResults } from '@/lib/aspire/queries'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { getAdminSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  const rows = await findProspectScoutResults(session.accountId, limit, offset)

  const data: AspireSearchResult[] = rows.map((row) => {
    const raw = row.rawData as Record<string, unknown>
    const icpScore = row.icpScore
    const icpSignals = (row.icpSignals as string[]) ?? []
    return {
      id: row.apolloId ?? row.id,
      firstName: String(raw.firstName ?? ''),
      lastName: String(raw.lastName ?? ''),
      title: String(raw.title ?? ''),
      email: typeof raw.email === 'string' ? raw.email : null,
      phone: typeof raw.phone === 'string' ? raw.phone : null,
      linkedinUrl: typeof raw.linkedinUrl === 'string' ? raw.linkedinUrl : null,
      organizationName: String(raw.organizationName ?? raw.company ?? ''),
      organizationId: typeof raw.organizationId === 'string' ? raw.organizationId : null,
      websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : null,
      city: typeof raw.city === 'string' ? raw.city : null,
      state: typeof raw.state === 'string' ? raw.state : null,
      employeeCount: typeof raw.employeeCount === 'number' ? raw.employeeCount : null,
      revenue: typeof raw.revenue === 'number' ? raw.revenue : null,
      industry: typeof raw.industry === 'string' ? raw.industry : null,
      technologies: Array.isArray(raw.technologies)
        ? raw.technologies.filter((t): t is string => typeof t === 'string')
        : [],
      photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : null,
      icpScore,
      icpSignals,
      intentScore: icpScore,
      company: String(raw.organizationName ?? raw.company ?? ''),
      status: row.status,
      resultId: row.id,
      source: 'prospect_scout' as const,
    }
  })

  return NextResponse.json({ success: true, data })
}
