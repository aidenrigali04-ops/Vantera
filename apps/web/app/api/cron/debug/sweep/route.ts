// Cron endpoint: autonomous debug agent sweep (every 30 minutes).
//
// Mirrors the Trigger.dev scheduled task as a Vercel Cron fallback.
// Authenticated via CRON_SECRET (same pattern as daily AI sweep).

import { runLarryAnalysis } from '@/lib/debug'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Larry — autonomous debug sweep (Vercel Cron fallback, every 30 min). */
export async function GET(req: Request): Promise<Response> {
  if (!authorize(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const report = await runLarryAnalysis({
    scope: {
      triggeredBy: 'scheduled',
      environment: process.env.VERCEL_ENV === 'production' ? 'production' : 'preview',
    },
    fixUntilResolved: true,
  })

  return Response.json({
    ok: report.unresolved.length === 0,
    agent: 'Larry',
    runId: report.runId,
    summary: report.summary,
    unresolved: report.unresolved.map((u) => ({ id: u.id, error: u.error })),
    report: report.formattedReport,
  })
}

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET
  if (!secret || secret.length === 0) {
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.0.0.1')
  }

  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}
