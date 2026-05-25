import { schedules } from '@trigger.dev/sdk'
import { runLarryAnalysis } from '@/lib/debug'

/**
 * Larry — scheduled debug sweep every 30 minutes.
 * Scans codebase + runtime stack, applies debug-only fixes, re-verifies until resolved.
 *
 * Deploy with: pnpm trigger:deploy
 */
export const larrySweep = schedules.task({
  id: 'larry-sweep',
  cron: '*/30 * * * *',
  run: async () => {
    const report = await runLarryAnalysis({
      scope: {
        triggeredBy: 'scheduled',
        environment: process.env.VERCEL_ENV === 'production' ? 'production' : 'preview',
      },
      fixUntilResolved: true,
    })

    return {
      agent: 'Larry',
      runId: report.runId,
      summary: report.summary,
      unresolved: report.unresolved.map((u) => ({ id: u.id, name: u.name, error: u.error })),
      durationMs: report.durationMs,
    }
  },
})

/** @deprecated Use larrySweep — kept for backward compatibility after deploy migration */
export const debugAgentSweep = larrySweep
