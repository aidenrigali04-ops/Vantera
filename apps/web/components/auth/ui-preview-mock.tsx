import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  Handshake,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Share2,
  Trophy,
  UserCircle,
  Users,
  Workflow,
} from 'lucide-react'

const MONTHS = [
  { label: 'Jan', solid: 38, hatch: 22 },
  { label: 'Fev', solid: 32, hatch: 18 },
  { label: 'Mar', solid: 44, hatch: 20 },
  { label: 'Apr', solid: 28, hatch: 16 },
  { label: 'May', solid: 48, hatch: 24 },
  { label: 'Jun', solid: 36, hatch: 20 },
  { label: 'Jul', solid: 42, hatch: 22, active: true },
  { label: 'Aug', solid: 30, hatch: 18 },
  { label: 'Sep', solid: 40, hatch: 20 },
] as const

function VanteraMark({ className, variant = 'dark' }: { className?: string; variant?: 'dark' | 'brand' }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md text-[13px] font-bold tracking-tight',
        variant === 'brand'
          ? 'bg-[var(--accent)] text-[var(--text-primary)]'
          : 'bg-[var(--text-primary)] text-[var(--text-inverse)]',
        className,
      )}
      aria-hidden
    >
      V
    </span>
  )
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="mb-2 flex items-start justify-between gap-1">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-[var(--radius-md)]',
            'bg-[var(--accent-muted)] text-[var(--text-primary)]',
          )}
        >
          {icon}
        </span>
        <MoreHorizontal className="size-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
      </div>
      <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

function OverviewBar({
  solid,
  hatch,
  active,
  label,
}: {
  solid: number
  hatch: number
  active?: boolean
  label: string
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center gap-1">
      {active ? (
        <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--text-primary)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-inverse)]">
          Conversion 45
        </div>
      ) : null}
      <div
        className={cn(
          'flex w-full max-w-[28px] flex-col justify-end overflow-hidden rounded-sm',
          active && 'ring-1 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-surface)]',
        )}
        style={{ height: solid + hatch }}
      >
        <div
          className="w-full shrink-0 bg-[var(--accent-solid)]"
          style={{ height: solid }}
        />
        <div
          className="w-full shrink-0 bg-[var(--accent-hatch)]"
          style={{
            height: hatch,
            backgroundImage:
              'repeating-linear-gradient(-45deg, var(--accent-solid) 0, var(--accent-solid) 2px, var(--bg-surface) 2px, var(--bg-surface) 4px)',
          }}
        />
      </div>
      <span className="text-[9px] font-medium text-[var(--text-tertiary)]">{label}</span>
    </div>
  )
}

/** Product dashboard preview for auth brand column — matches live Vantera shell. */
export function UiPreviewMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)]',
        'bg-[var(--bg-surface)] shadow-[var(--shadow-md)]',
        className,
      )}
      aria-hidden
    >
      <div className="flex min-h-[360px]">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex w-[52px] shrink-0 flex-col border-r border-[var(--border-subtle)] px-2 py-3',
            'sidebar-gradient',
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <VanteraMark className="size-6 rounded-[6px] text-[11px]" />
            <ChevronLeft className="size-3 text-[var(--text-tertiary)]" aria-hidden />
          </div>

          <nav className="flex flex-1 flex-col gap-0.5" aria-hidden>
            {(
              [
                { label: 'Dashboard', icon: LayoutDashboard, active: true },
                { label: 'CRM', icon: Users, active: false },
                { label: 'Pipeline', icon: Handshake, active: false },
                { label: 'Outreach', icon: Megaphone, active: false },
              ] as const
            ).map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                title={label}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[var(--radius-md)]',
                  active
                    ? 'bg-[var(--bg-overlay)] text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)]',
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
              </div>
            ))}
          </nav>

          <div className="mt-auto space-y-0.5 border-t border-[var(--border-subtle)] pt-2">
            <div className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)]">
              <Share2 className="size-3.5" strokeWidth={2} />
            </div>
            <div className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)]">
              <UserCircle className="size-3.5" strokeWidth={2} />
            </div>
          </div>
        </aside>

        {/* Main workspace */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg-surface)] p-3">
          {/* Breadcrumb */}
          <div className="mb-1 flex items-center gap-1.5 text-[9px] text-[var(--text-secondary)]">
            <ArrowLeft className="size-2.5 shrink-0" aria-hidden />
            <span className="font-medium">Team</span>
            <span className="text-[var(--text-tertiary)]">&gt;</span>
            <VanteraMark variant="brand" className="size-4 rounded-[4px] text-[9px]" />
            <span className="font-medium text-[var(--text-primary)]">Vantera</span>
          </div>

          <h3 className="mb-3 text-[17px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Dashboard
          </h3>

          {/* KPI row */}
          <div className="mb-3 flex gap-2">
            <KpiCard
              label="Conversion"
              value="702"
              icon={<Trophy className="size-3.5 text-[var(--accent)]" strokeWidth={2} />}
            />
            <KpiCard
              label="Revenue"
              value="$423,000"
              icon={<Workflow className="size-3.5" strokeWidth={2} />}
            />
            <div className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 opacity-90 shadow-[var(--shadow-sm)]">
              <div className="mb-2 flex items-start justify-between">
                <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                  <Calendar className="size-3.5" strokeWidth={2} />
                </span>
              </div>
              <p className="truncate text-[10px] text-[var(--text-secondary)]">Schedule</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                195 Q…
              </p>
            </div>
          </div>

          {/* Overview chart */}
          <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
            <p className="mb-3 text-[11px] font-semibold text-[var(--text-primary)]">Overview</p>
            <div className="flex flex-1 items-end justify-between gap-1 pt-6">
              {MONTHS.map((month) => (
                <OverviewBar key={month.label} {...month} />
              ))}
            </div>
          </div>

          <p className="mt-2.5 text-[11px] font-semibold text-[var(--text-primary)]">Campaigns</p>
        </div>
      </div>
    </div>
  )
}
