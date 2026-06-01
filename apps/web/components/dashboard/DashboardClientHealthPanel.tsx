import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useMemo } from 'react'

const HEALTH_META = {
  healthy: { label: 'Healthy', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' },
  watch: { label: 'Watch', className: 'bg-amber-50 text-amber-800 ring-amber-200/80' },
  at_risk: { label: 'At risk', className: 'bg-red-50 text-red-700 ring-red-200/80' },
} as const

type Props = {
  clients: DashboardSnapshot['clients']
}

export function DashboardClientHealthPanel({ clients }: Props) {
  const summary = useMemo(() => {
    return {
      healthy: clients.filter((c) => c.healthStatus === 'healthy').length,
      watch: clients.filter((c) => c.healthStatus === 'watch').length,
      at_risk: clients.filter((c) => c.healthStatus === 'at_risk').length,
    }
  }, [clients])

  const atRisk = useMemo(
    () => clients.filter((c) => c.healthStatus === 'at_risk' || c.healthStatus === 'watch').slice(0, 4),
    [clients],
  )

  if (clients.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-stone-500">
        Client health scores appear once you add active clients to your workspace.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(HEALTH_META) as Array<keyof typeof HEALTH_META>).map((key) => (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset',
              HEALTH_META[key].className,
            )}
          >
            {HEALTH_META[key].label}
            <span className="tabular-nums">{summary[key]}</span>
          </span>
        ))}
      </div>

      {atRisk.length > 0 ? (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
          {atRisk.map((client) => {
            const name = client.source ?? `${client.firstName} ${client.lastName}`.trim()
            return (
              <li key={client.id}>
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-stone-900">{name}</p>
                    <p className="text-[11px] text-stone-500">
                      Risk score {client.churnRiskScore}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
                      HEALTH_META[client.healthStatus].className,
                    )}
                  >
                    {HEALTH_META[client.healthStatus].label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-stone-500">All clients are in good standing.</p>
      )}
    </div>
  )
}
