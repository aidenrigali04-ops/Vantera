import { syncEnvVars } from '@trigger.dev/build/extensions/core'
import { defineConfig } from '@trigger.dev/sdk'
import { collectEnvVarsForTriggerSync } from './trigger-env-sync'

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? '',
  dirs: ['./apps/web/trigger'],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  maxDuration: 3600,
  build: {
    extensions: [
      // Vercel env vars do not reach Trigger.dev workers — sync from .env on deploy.
      syncEnvVars(async () => collectEnvVarsForTriggerSync()),
    ],
  },
})
