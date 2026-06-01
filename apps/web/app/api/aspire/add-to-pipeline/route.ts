import { EnrollError, enrollLeadFromAspire } from '@/lib/aspire/enroll'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { getAdminSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

function toApolloPerson(result: AspireSearchResult) {
  return {
    id: result.id,
    firstName: result.firstName,
    lastName: result.lastName,
    title: result.title,
    email: result.email ?? null,
    phone: result.phone ?? null,
    linkedinUrl: result.linkedinUrl ?? null,
    organizationName: result.organizationName ?? result.company,
    organizationId: result.organizationId ?? null,
    websiteUrl: result.websiteUrl ?? null,
    city: result.city ?? null,
    state: result.state ?? null,
    employeeCount: result.employeeCount ?? null,
    revenue: result.revenue ?? null,
    industry: result.industry ?? null,
    technologies: result.technologies ?? [],
    photoUrl: result.photoUrl ?? null,
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as AspireSearchResult
  const company = body.organizationName ?? body.company
  if (!company) {
    return NextResponse.json({ success: false, error: 'Company is required' }, { status: 400 })
  }

  try {
    const enrolled = await enrollLeadFromAspire(toApolloPerson(body), '', 'prospect')
    return NextResponse.json({ success: true, data: { id: enrolled.leadId } }, { status: 201 })
  } catch (error) {
    if (error instanceof EnrollError) {
      const status = error.code === 'ALREADY_ENROLLED' ? 409 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    return NextResponse.json({ success: false, error: 'Failed to add to pipeline' }, { status: 500 })
  }
}
