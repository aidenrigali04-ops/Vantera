/**
 * Larry — manual analysis CLI.
 * Usage: pnpm larry:run  (from Vantera repo root)
 */
import { loadProjectEnv } from '@/lib/load-project-env'
import { runLarryAnalysis } from './agent'
import { LARRY_NAME } from './guardrails'

const { loadedFrom } = loadProjectEnv()

console.log(`[${LARRY_NAME}] Running full codebase + stack analysis...`)
if (loadedFrom) {
  console.log(`[${LARRY_NAME}] Loaded env from ${loadedFrom}\n`)
} else {
  console.log(`[${LARRY_NAME}] Using process environment (no .env file found)\n`)
}

runLarryAnalysis({ scope: { triggeredBy: 'auto-detect' }, fixUntilResolved: true })
  .then((report) => {
    process.stdout.write(`${report.formattedReport}\n`)
    process.exit(report.unresolved.length === 0 ? 0 : 1)
  })
  .catch((error) => {
    console.error(`[${LARRY_NAME}] Analysis failed:`, error)
    process.exit(1)
  })
