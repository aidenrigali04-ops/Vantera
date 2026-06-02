import { scoreICP } from '@/lib/aspire/icp-score'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { consumeSdrCredits, SdrCreditsExhaustedError } from '@/lib/sdr/credits'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { enrollProspect } from '@/lib/prospect-scout/enroll'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
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
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'SDR not enabled' },
      { status: 403 },
    )
  }

  const config = await findSdrConfigByAccount(session.accountId)
  if (!config) {
    return NextResponse.json(
      { success: false, error: 'Set up Prospect Scout before enrolling leads' },
      { status: 400 },
    )
  }

  const body = (await request.json()) as AspireSearchResult & { searchId?: string | null }
  const company = body.organizationName ?? body.company
  if (!company) {
    return NextResponse.json({ success: false, error: 'Company is required' }, { status: 400 })
  }

  const [account] = await db
    .select({ vertical: accounts.vertical, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const person = toApolloPerson(body)
  const icpConfig = config.icpConfig as import('@/lib/aspire/types').ICPConfig
  const scored = scoreICP(person, icpConfig)
  const icpScore = body.icpScore ?? scored.score
  const icpSignals = body.icpSignals?.length ? body.icpSignals : scored.signals

  const startSdrSequence = config.isActive && !config.isPaused

  try {
    await consumeSdrCredits(session.accountId, 'pipeline_enroll', person.id)
  } catch (error) {
    if (error instanceof SdrCreditsExhaustedError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 402 },
      )
    }
    throw error
  }

  try {
    const result = await enrollProspect({
      accountId: session.accountId,
      config,
      person,
      searchId: body.searchId ?? null,
      icpScore,
      icpSignals,
      startSdrSequence,
      pipelineOnlyFromScout: !startSdrSequence,
      accountName: account?.name ?? undefined,
      skipCreditCharge: true,
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Enroll failed' },
      { status: 500 },
    )
  }
}
