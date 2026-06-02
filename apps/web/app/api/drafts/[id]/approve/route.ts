import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { isAiMessageDraftingEnabled } from '@/lib/ai/drafting-enabled'
import type { Plan } from '@/lib/feature-flags/flags'
import { sendCampaignEmail } from '@/lib/outreach/send-email'
import { sendCampaignSms } from '@/lib/outreach/send-sms'
import { sendSdrSequenceStepNow, SdrSendBlockedError } from '@/lib/sdr/send-single-step'
import { accounts, activities, automationRuns, leadDrafts, leads } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const [row] = await db
    .select({ draft: leadDrafts, lead: leads, account: accounts })
    .from(leadDrafts)
    .innerJoin(leads, eq(leadDrafts.leadId, leads.id))
    .innerJoin(accounts, eq(leadDrafts.accountId, accounts.id))
    .where(
      and(
        eq(leadDrafts.id, id),
        eq(leadDrafts.accountId, session.accountId),
        isNull(leadDrafts.deletedAt),
      ),
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
  }

  if (row.draft.status !== 'pending_review') {
    return NextResponse.json(
      { success: false, error: 'Draft already processed', code: 'ALREADY_SENT' },
      { status: 409 },
    )
  }

  const draftingEnabled = await isAiMessageDraftingEnabled(
    session.accountId,
    row.account.plan as Plan,
  )

  if (!draftingEnabled) {
    return NextResponse.json(
      { success: false, error: 'AI drafting is disabled. Configure ANTHROPIC_API_KEY.' },
      { status: 403 },
    )
  }

  const metadata = (row.draft.metadata ?? {}) as {
    sdrSequenceId?: string
    sequenceStepId?: string
    stepNumber?: number
  }

  if (metadata.sequenceStepId) {
    try {
      await sendSdrSequenceStepNow({
        accountId: session.accountId,
        stepId: metadata.sequenceStepId,
      })
    } catch (error) {
      if (error instanceof SdrSendBlockedError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      }
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Could not send sequence step',
        },
        { status: 502 },
      )
    }

    await db
      .update(leadDrafts)
      .set({
        status: 'sent',
        sentAt: new Date(),
        approvedBy: session.userId,
      })
      .where(eq(leadDrafts.id, id))

    await db.insert(activities).values({
      accountId: session.accountId,
      leadId: row.lead.id,
      actorType: 'user',
      actorId: session.userId,
      activityType: 'sdr_step_approved_and_sent',
      body: `Approved and sent ${row.draft.channel} sequence step`,
      metadata: {
        draftId: id,
        sequenceStepId: metadata.sequenceStepId,
        sequenceId: metadata.sdrSequenceId,
      },
      visibleToClient: false,
    })

    return NextResponse.json({
      success: true,
      data: { draftId: id, sentAt: new Date().toISOString(), sequenceStepId: metadata.sequenceStepId },
    })
  }

  if (row.draft.channel === 'email') {
    if (!row.lead.email) {
      return NextResponse.json({ success: false, error: 'Lead has no email' }, { status: 400 })
    }

    const sent = await sendCampaignEmail({
      accountId: session.accountId,
      accountName: row.account.name,
      toEmail: row.lead.email,
      subject: row.draft.subject ?? 'Quick note',
      body: row.draft.body,
      lead: {
        firstName: row.lead.firstName,
        lastName: row.lead.lastName,
        company: row.lead.company,
        email: row.lead.email,
        title: row.lead.title,
      },
      stepId: row.draft.id,
    })

    if (!sent.ok) {
      return NextResponse.json({ success: false, error: sent.reason }, { status: 502 })
    }
  } else if (row.draft.channel === 'sms') {
    if (!row.lead.phone) {
      return NextResponse.json({ success: false, error: 'Lead has no phone number' }, { status: 400 })
    }

    const sent = await sendCampaignSms({
      accountId: session.accountId,
      toPhone: row.lead.phone,
      body: row.draft.body,
      lead: {
        firstName: row.lead.firstName,
        lastName: row.lead.lastName,
        company: row.lead.company,
        email: row.lead.email,
        title: row.lead.title,
      },
    })

    if (!sent.ok) {
      return NextResponse.json({ success: false, error: sent.reason }, { status: 502 })
    }
  } else if (row.draft.channel === 'linkedin') {
    return NextResponse.json(
      {
        success: false,
        error: 'LinkedIn drafts must be sent manually — copy from the lead profile',
      },
      { status: 400 },
    )
  } else {
    return NextResponse.json({ success: false, error: 'Unsupported draft channel' }, { status: 400 })
  }

  await db
    .update(leadDrafts)
    .set({
      status: 'sent',
      sentAt: new Date(),
      approvedBy: session.userId,
    })
    .where(eq(leadDrafts.id, id))

  await db.insert(activities).values({
    accountId: session.accountId,
    leadId: row.lead.id,
    actorType: 'user',
    actorId: session.userId,
    activityType: 'draft_approved_and_sent',
    body: `Approved and sent ${row.draft.channel} draft`,
    metadata: { draftId: id, channel: row.draft.channel },
    visibleToClient: false,
  })

  const automationId = await getSystemAutomationId(session.accountId, 'draft')
  await db.insert(automationRuns).values({
    accountId: session.accountId,
    automationId,
    triggerEvent: 'draft_approved',
    triggerPayload: { draftId: id, leadId: row.lead.id },
    actionType: 'send_draft',
    status: 'success',
    resultPayload: { channel: row.draft.channel },
  })

  return NextResponse.json({
    success: true,
    data: { draftId: id, sentAt: new Date().toISOString() },
  })
}
