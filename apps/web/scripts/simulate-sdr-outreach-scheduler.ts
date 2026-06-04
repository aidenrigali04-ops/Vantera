/**
 * Diagnose why sdr-outreach-scheduler sends nothing (dry run — no emails sent).
 * Run from repo root:
 *   pnpm --filter @vantera/web exec tsx scripts/simulate-sdr-outreach-scheduler.ts
 * Optional: DEBUG_TEST_ACCOUNT_ID_TEAM=<uuid>
 */
import { loadProjectEnv } from '@/lib/load-project-env'
import { diagnoseOutreachSend } from '@/lib/sdr/diagnose-outreach-send'

const { loadedFrom } = loadProjectEnv()
const accountId = process.env.DEBUG_TEST_ACCOUNT_ID_TEAM

console.log('SDR outreach scheduler simulation (dry run)\n')
if (loadedFrom) console.log(`Env: ${loadedFrom}`)
if (accountId) console.log(`Account filter: ${accountId}\n`)

async function main() {
  const diagnosis = await diagnoseOutreachSend({ accountId })

  console.log('=== Pipeline hints ===')
  if (diagnosis.pipelineHints.length === 0) {
    console.log('(none — configuration looks send-ready)')
  } else {
    for (const hint of diagnosis.pipelineHints) {
      console.log(`• ${hint}`)
    }
  }

  console.log('\n=== Account diagnostics ===')
  if (diagnosis.accounts.length === 0) {
    console.log('No active SDR configs found.')
  } else {
    for (const row of diagnosis.accounts) {
      console.log(`\n${row.agentName} (${row.accountId.slice(0, 8)}…)`)
      console.log(`  Mode: ${row.outreachMode}`)
      console.log(`  Send window now: ${row.inSendWindow ? 'yes' : 'no'}`)
      console.log(`  Outreach day now: ${row.onOutreachDay ? 'yes' : 'no'} [${row.outreachDays.join(', ')}]`)
      console.log(`  Due steps: ${row.dueStepCount}`)
      console.log(`  Ready to send: ${row.readyToSendCount}`)
      if (row.skipped) {
        console.log(`  SKIP: ${row.skipReason}`)
        if (row.detail) console.log(`  → ${row.detail}`)
      }
    }
  }

  console.log('\n=== Scheduler would send ===')
  console.log(`Accounts checked: ${diagnosis.accountsChecked}`)
  console.log(`Accounts skipped: ${diagnosis.accountsSkipped}`)
  console.log(`Due steps (scheduled, past due): ${diagnosis.dueStepsTotal}`)
  console.log(`Ready to send (email/SMS, active seq): ${diagnosis.readyToSendTotal}`)
  console.log(`Would send (if guards pass): ${diagnosis.wouldSendWithoutDryRun}`)

  const blockers = diagnosis.accounts.filter((a) => a.skipped)
  if (blockers.length > 0) {
    console.log('\n=== Top blockers (fix these first) ===')
    for (const b of blockers) {
      console.log(`• ${b.skipReason}: ${b.detail ?? b.agentName}`)
    }
    process.exit(1)
  }

  if (diagnosis.readyToSendTotal === 0) {
    console.log('\nNo blockers on config, but nothing is ready to send — enroll leads and run Lead Profiler.')
    process.exit(1)
  }

  console.log('\nScheduler should send on next run (or redeploy task and test in Trigger.dev).')
}

main().catch((error) => {
  console.error('Simulation failed:', error)
  process.exit(1)
})
