'use client'

import type { SdrCreditStatus } from '@/lib/sdr/credit-types'
import { useQuery, useQueryClient } from '@tanstack/react-query'

async function fetchSdrCredits(): Promise<SdrCreditStatus> {
  const res = await fetch('/api/sdr/credits', { credentials: 'same-origin' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Could not load credits')
  return json.data as SdrCreditStatus
}

export function useSdrCredits(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sdr-credits'],
    queryFn: fetchSdrCredits,
    enabled,
    staleTime: 30_000,
  })

  async function refreshCredits() {
    await queryClient.invalidateQueries({ queryKey: ['sdr-credits'] })
  }

  async function startTrial(): Promise<SdrCreditStatus> {
    const res = await fetch('/api/sdr/credits/trial', { method: 'POST' })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error ?? 'Could not start trial')
    }
    const status = json.data as SdrCreditStatus
    queryClient.setQueryData(['sdr-credits'], status)
    return status
  }

  const exhausted =
    !query.data?.unlimited && (query.data?.remaining ?? 0) <= 0 && !query.isLoading

  return {
    ...query,
    credits: query.data,
    exhausted,
    refreshCredits,
    startTrial,
  }
}
