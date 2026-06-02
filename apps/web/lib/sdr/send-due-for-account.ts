import { runSdrAgentSend } from '@/lib/sdr/run-send'

/** Process due SDR sequence sends for a single account (after auto sequence draft). */
export async function sendDueSdrStepsForAccount(accountId: string): Promise<{
  sent: number
  failed: number
}> {
  return runSdrAgentSend({ accountId })
}
