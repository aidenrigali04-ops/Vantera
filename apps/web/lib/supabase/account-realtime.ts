'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useEffect, useRef, useState } from 'react'

export type AccountRealtimeTable =
  | 'aspire_search_runs'
  | 'aspire_results'
  | 'sdr_activity_log'

type RowWithAccount = { account_id?: string; search_id?: string }

export type UseAccountRealtimeOptions = {
  accountId: string
  table: AccountRealtimeTable
  /** When set on aspire_results, ignore changes for other searches */
  searchId?: string | null
  onChange: () => void
  enabled?: boolean
}

/**
 * Subscribes to postgres_changes for a tenant-scoped table.
 * Requires migration 0014 (JWT RLS + supabase_realtime publication).
 */
export function useAccountRealtime({
  accountId,
  table,
  searchId,
  onChange,
  enabled = true,
}: UseAccountRealtimeOptions): { isLive: boolean } {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!enabled || !accountId) {
      setIsLive(false)
      return
    }

    const supabase = createSupabaseBrowserClient()
    const channelName = `account-rt:${table}:${accountId}:${searchId ?? 'all'}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          if (table === 'aspire_results' && searchId) {
            const row = (payload.new ?? payload.old) as RowWithAccount | null
            const sid = row?.search_id
            if (sid && sid !== searchId) return
          }
          onChangeRef.current()
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      setIsLive(false)
      void supabase.removeChannel(channel)
    }
  }, [accountId, table, searchId, enabled])

  return { isLive }
}
