'use client'

import { cn } from '@/lib/utils'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { onboardingSuccessStorageKey } from '@/lib/import/fields'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { DashboardActionFeed } from './DashboardActionFeed'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CalendarPlus,
  Mail,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type DashboardClientProps = {
  email: string
  role: string
  businessName: string
  primaryColor: string
  snapshot: DashboardSnapshot
  actionFeed: ActionFeedItem[]
  accountId: string
  onboardingIncomplete?: boolean
}

function formatCurrency(cents: number): string {
  if (!cents) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

export function DashboardClient({
  email,
  businessName,
  primaryColor,
  snapshot,
  actionFeed,
  accountId,
  onboardingIncomplete = false,
}: DashboardClientProps) {
  const {
    clients,
    deals,
    projects,
    isEmpty,
    pipelineValueCents,
    weightedPipelineValueCents,
    wonValueCents,
  } = snapshot

  const showCleanSlate = isEmpty && onboardingIncomplete
  const [successNotice, setSuccessNotice] = useState<OnboardingSuccessNotice | null>(null)

  useEffect(() => {
    const raw = window.sessionStorage.getItem(onboardingSuccessStorageKey(accountId))
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.kind && typeof parsed.kind === 'string') {
        setSuccessNotice(parsed as OnboardingSuccessNotice)
        return
      }
      if (parsed.entity && typeof parsed.count === 'number') {
        setSuccessNotice({
          kind: 'import',
          entity: parsed.entity as Extract<OnboardingSuccessNotice, { kind: 'import' }>['entity'],
          count: parsed.count,
        })
      }
    } catch {
      window.sessionStorage.removeItem(onboardingSuccessStorageKey(accountId))
    }
  }, [accountId])

  function dismissSuccessNotice() {
    window.sessionStorage.removeItem(onboardingSuccessStorageKey(accountId))
    setSuccessNotice(null)
  }

  const openDeals = useMemo(
    () => deals.filter((d) => !d.isTerminalWin && !d.isTerminalLoss),
    [deals],
  )

  const pipelineColumns = useMemo(() => {
    const byStage = new Map<
      string,
      { label: string; color: string; position: number; deals: typeof deals }
    >()
    for (const d of deals) {
      if (d.isTerminalLoss) continue
      const existing = byStage.get(d.stageLabel) ?? {
        label: d.stageLabel,
        color: d.stageColor,
        position: d.stagePosition,
        deals: [],
      }
      existing.deals.push(d)
      byStage.set(d.stageLabel, existing)
    }
    return Array.from(byStage.values()).sort((a, b) => a.position - b.position)
  }, [deals])

  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  return (
    // The outer wrapper paints the dark page surface even if the AdminShell
    // ever fails to wrap (e.g. layout error, edge swap race, stale deploy).
    // All inner surfaces assume a dark page below them — `bg-white/[0.02]`
    // cards are invisible on a light body, so this is a hard requirement
    // rather than a nice-to-have.
    <div className="relative min-h-screen w-full bg-[#0A0E14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 size-[40rem] opacity-[0.08] blur-3xl"
        style={{
          background: `radial-gradient(circle at top right, ${primaryColor}, transparent 65%)`,
        }}
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-7xl space-y-8 px-6 py-10 sm:px-10"
      >
      {showCleanSlate ? (
        <motion.section variants={fadeUp}>
          <CleanSlateWelcome primaryColor={primaryColor} />
        </motion.section>
      ) : null}

      {/* Hero */}
      <motion.section variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/55">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            />
            {showCleanSlate ? 'Fresh workspace' : onboardingIncomplete ? 'Demo workspace' : today}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {showCleanSlate
              ? 'Your workspace is ready'
              : onboardingIncomplete
                ? `Explore ${businessName || 'your workspace'}`
                : `Welcome back, ${firstNameFromEmail(email)}.`}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/55">
            {showCleanSlate
              ? 'Pipeline stages and delivery views are configured. Add your first client to bring the system online.'
              : onboardingIncomplete
                ? 'Sample clients, opportunities, and projects are loaded so you can see how everything connects — no setup required yet.'
                : `Here's the pulse of ${businessName}. Your AI brain is watching for signals while you focus on the work that actually moves the needle.`}
          </p>
        </div>

        {!onboardingIncomplete && !showCleanSlate ? (
          <div className="flex items-center gap-2">
            <PrimaryAction icon={Plus} label="Add client" primaryColor={primaryColor} />
            <SecondaryAction icon={Briefcase} label="New opportunity" />
          </div>
        ) : null}
      </motion.section>

      <motion.section variants={fadeUp} data-tour="action-feed">
        <DashboardActionFeed
          items={actionFeed}
          successNotice={successNotice}
          onDismissSuccessNotice={dismissSuccessNotice}
          emptyMessage={
            showCleanSlate
              ? "Your workspace is ready. Let's add your first client."
              : undefined
          }
          className="border-white/[0.06] bg-white/[0.03] text-white [&_h2]:text-white/55 [&_p]:text-white/70 [&_a:hover]:bg-white/[0.04] [&_span]:text-white/40 [&_.rounded-full]:bg-white/[0.06] [&_svg]:text-white/60 [&_.border-emerald-200\\/80]:border-emerald-400/30 [&_.bg-emerald-50\\/90]:bg-emerald-500/10 [&_.text-emerald-950]:text-emerald-100 [&_.text-emerald-800]:text-emerald-200"
        />
      </motion.section>

      {/* KPI grid */}
      <motion.section variants={fadeUp} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Active clients"
          value={clients.length}
          icon={Users}
          accent="#3B82F6"
          primaryColor={primaryColor}
          gettingStarted={showCleanSlate}
        />
        <KpiTile
          label="Open opportunities"
          value={openDeals.length}
          icon={TrendingUp}
          accent="#F59E0B"
          primaryColor={primaryColor}
          gettingStarted={showCleanSlate}
        />
        <KpiTile
          label="Pipeline value"
          value={pipelineValueCents}
          icon={Briefcase}
          accent={primaryColor}
          primaryColor={primaryColor}
          format="currency"
          gettingStarted={showCleanSlate}
        />
        <KpiTile
          label="Weighted pipeline"
          value={weightedPipelineValueCents}
          icon={Sparkles}
          accent="#10B981"
          primaryColor={primaryColor}
          format="currency"
          gettingStarted={showCleanSlate}
          sub={wonValueCents ? `${formatCurrency(wonValueCents)} won YTD` : undefined}
        />
      </motion.section>

      {/* Pipeline */}
      <motion.section variants={fadeUp} data-tour="dashboard-pipeline">
        <Card>
          <CardHeader
            title="Pipeline"
            subtitle="Opportunities across each stage — terminal-loss stages are hidden"
            right={
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-xs font-medium text-white/70 ring-1 ring-inset ring-white/[0.06]">
                <span aria-hidden className="size-1.5 rounded-full bg-white/40" />
                {openDeals.length} open
              </span>
            }
          />
          <div className="p-5 pt-2">
            {pipelineColumns.length === 0 ? (
              <EmptyPipeline showCleanSlate={showCleanSlate} primaryColor={primaryColor} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {pipelineColumns.map((col) => (
                  <PipelineColumn key={col.label} column={col} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </motion.section>

      {/* Two-up row: Recent clients + Quick actions */}
      <motion.section variants={fadeUp} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent clients"
            subtitle={`${clients.length} active · last updated just now`}
            right={
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 text-xs font-medium text-white/40 hover:text-white/70 disabled:cursor-not-allowed"
              >
                View all
                <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            }
          />
          <div className="px-5 pb-5">
            {clients.length === 0 ? (
              <EmptyState
                title="No clients yet"
                subtitle="Add your first client to start tracking opportunities and projects against them."
                cta="Add a client"
                primaryColor={primaryColor}
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {clients.slice(0, 6).map((c, idx) => (
                  <ClientRow key={c.id} client={c} index={idx} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" subtitle="Common operator tasks" />
          <div className="space-y-2 px-5 pb-5">
            <QuickAction
              icon={Plus}
              title="Add a client"
              subtitle="Contact details + source"
              accent={primaryColor}
            />
            <QuickAction
              icon={CalendarPlus}
              title="Schedule visit"
              subtitle="Block calendar + auto-confirm"
              accent="#10B981"
              disabled
            />
            <QuickAction
              icon={Mail}
              title="Send broadcast"
              subtitle="Voice-personalized message blast"
              accent="#F59E0B"
              disabled
            />
            <QuickAction
              icon={Sparkles}
              title="Ask the brain"
              subtitle="Draft, classify, score, summarize"
              accent="#8B5CF6"
              href="/admin/ai-brain"
            />
          </div>
        </Card>
      </motion.section>

      {/* Projects strip */}
      {projects.length > 0 ? (
        <motion.section variants={fadeUp}>
          <Card>
            <CardHeader
              title="Active projects"
              subtitle={`${projects.length} in flight`}
              right={
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 text-xs font-medium text-white/40 hover:text-white/70 disabled:cursor-not-allowed"
                >
                  View all
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              }
            />
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.slice(0, 6).map((p, idx) => (
                  <ProjectCard key={p.id} project={p} index={idx} />
                ))}
              </div>
            </div>
          </Card>
        </motion.section>
      ) : showCleanSlate ? (
        <motion.section variants={fadeUp}>
          <Card>
            <CardHeader title="Projects" subtitle="Delivery work tied to clients" />
            <div className="px-5 pb-5">
              <CleanSlateProjectsEmpty primaryColor={primaryColor} />
            </div>
          </Card>
        </motion.section>
      ) : null}
      </motion.div>
    </div>
  )
}

/* ─────────────────────────── KPI Tile ─────────────────────────── */

function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
  primaryColor,
  sub,
  format = 'number',
  gettingStarted = false,
}: {
  label: string
  value: number
  icon: LucideIcon
  accent: string
  primaryColor: string
  sub?: string
  format?: 'number' | 'currency'
  gettingStarted?: boolean
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at center, ${accent}, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between">
        <span
          aria-hidden
          style={{
            background: `linear-gradient(135deg, ${accent}33, ${accent}0a)`,
            boxShadow: `inset 0 0 0 1px ${accent}33`,
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg"
        >
          <Icon className="h-4 w-4" style={{ color: accent }} aria-hidden />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
          {gettingStarted ? 'Getting started' : 'Last 30d'}
        </span>
      </div>

      <div className="relative mt-5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            <CountUp value={value} format={format} />
          </p>
        </div>
        {sub ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-white/45">
            <ArrowUpRight className="h-3 w-3" style={{ color: primaryColor }} aria-hidden />
            {sub}
          </p>
        ) : null}
      </div>
    </motion.div>
  )
}

function CountUp({ value, format }: { value: number; format: 'number' | 'currency' }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 1.2, bounce: 0 })
  const rounded = useTransform(spring, (latest) => {
    if (format === 'currency') return formatCurrency(latest)
    return Math.round(latest).toLocaleString('en-US')
  })

  useEffect(() => {
    mv.set(value)
  }, [mv, value])

  return <motion.span>{rounded}</motion.span>
}

/* ──────────────────────── Pipeline Column ───────────────────────── */

function PipelineColumn({
  column,
}: {
  column: { label: string; color: string; position: number; deals: DashboardSnapshot['deals'] }
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: column.color, boxShadow: `0 0 6px ${column.color}66` }}
        />
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-white/70">
          {column.label}
        </span>
        <span className="ml-auto rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-white/55">
          {column.deals.length}
        </span>
      </div>

      <div className="space-y-2">
        {column.deals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] p-3 text-center text-[11px] text-white/30">
            No opportunities
          </div>
        ) : (
          column.deals.map((d, idx) => <DealCard key={d.id} deal={d} index={idx} />)
        )}
      </div>
    </div>
  )
}

function DealCard({ deal, index }: { deal: DashboardSnapshot['deals'][number]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className="cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06]"
    >
      <p className="truncate text-xs font-medium leading-tight text-white">{deal.title}</p>
      <p className="mt-1 truncate text-[10px] text-white/50">{deal.contactName}</p>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85">{formatCurrency(deal.valueCents)}</span>
        <span className="text-white/40">{deal.closeProbability}%</span>
      </div>
    </motion.div>
  )
}

function EmptyPipeline({
  showCleanSlate = false,
  primaryColor,
}: {
  showCleanSlate?: boolean
  primaryColor?: string
}) {
  const { setNewClientDrawerOpen } = useOnboardingStore()

  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center">
      <p className="text-sm font-medium text-white/70">
        {showCleanSlate ? 'No opportunities yet.' : 'No active opportunities.'}
      </p>
      <p className="mt-1 text-xs text-white/40">
        {showCleanSlate
          ? 'Opportunities track your active revenue. Add a client first, then create one here.'
          : 'Add a client and create an opportunity — your stages are already configured.'}
      </p>
      {showCleanSlate ? (
        <button
          type="button"
          onClick={() => setNewClientDrawerOpen(true)}
          className="mt-4 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/[0.06]"
          style={{ boxShadow: primaryColor ? `0 0 0 1px ${primaryColor}22 inset` : undefined }}
        >
          Create an opportunity
        </button>
      ) : null}
    </div>
  )
}

function CleanSlateProjectsEmpty({ primaryColor }: { primaryColor: string }) {
  const { setNewClientDrawerOpen } = useOnboardingStore()

  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-6 py-10 text-center">
      <p className="text-sm font-medium text-white/70">No projects yet.</p>
      <p className="mt-1 text-xs text-white/40">
        Projects manage your active client work. Start with a client, then add delivery work.
      </p>
      <button
        type="button"
        onClick={() => setNewClientDrawerOpen(true)}
        className="mt-4 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/[0.06]"
        style={{ boxShadow: `0 0 0 1px ${primaryColor}22 inset` }}
      >
        Create a project
      </button>
    </div>
  )
}

/* ────────────────────── Recent client row ─────────────────────── */

function ClientHealthDot({ status }: { status: DashboardSnapshot['clients'][number]['healthStatus'] }) {
  const colors = {
    healthy: 'bg-emerald-400',
    watch: 'bg-amber-400',
    at_risk: 'bg-red-400',
  } as const
  const labels = {
    healthy: 'Healthy',
    watch: 'Needs attention',
    at_risk: 'At risk',
  } as const

  return (
    <span
      className={cn('inline-block size-1.5 shrink-0 rounded-full', colors[status])}
      title={labels[status]}
      aria-label={labels[status]}
    />
  )
}

function ClientRow({
  client,
  index,
}: {
  client: DashboardSnapshot['clients'][number]
  index: number
}) {
  const display = client.source ?? `${client.firstName} ${client.lastName}`
  const initial = (display?.trim()?.[0] ?? '?').toUpperCase()

  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 * index, ease: 'easeOut' }}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white/80 ring-1 ring-inset ring-white/10"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ClientHealthDot status={client.healthStatus} />
          <p className="truncate text-sm font-medium text-white">{display}</p>
          {client.isSample ? (
            <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/40">
              Sample
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-white/45">
          {client.firstName} {client.lastName}
          {client.email ? ` · ${client.email}` : ''}
        </p>
      </div>
      <button
        type="button"
        disabled
        className="rounded-md px-2 py-1 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/80 disabled:cursor-not-allowed"
      >
        View
      </button>
    </motion.li>
  )
}

/* ────────────────────────── Quick action ────────────────────────── */

function QuickAction({
  icon: Icon,
  title,
  subtitle,
  accent,
  href,
  disabled,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  accent: string
  href?: string
  disabled?: boolean
}) {
  const inner = (
    <motion.div
      whileHover={disabled ? undefined : { x: 2 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-white/[0.12] hover:bg-white/[0.04]',
      )}
    >
      <span
        aria-hidden
        style={{
          background: `linear-gradient(135deg, ${accent}33, ${accent}0a)`,
          boxShadow: `inset 0 0 0 1px ${accent}33`,
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon className="h-4 w-4" style={{ color: accent }} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="truncate text-[11px] text-white/45">{subtitle}</p>
      </div>
      <ArrowRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-transform',
          disabled ? 'text-white/20' : 'text-white/30 group-hover:translate-x-0.5',
        )}
        aria-hidden
      />
    </motion.div>
  )

  if (disabled || !href) {
    return <div aria-disabled="true">{inner}</div>
  }

  return (
    <a href={href} className="block">
      {inner}
    </a>
  )
}

/* ───────────────────────── Project card ───────────────────────── */

function ProjectCard({
  project,
  index,
}: {
  project: DashboardSnapshot['projects'][number]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-white">{project.title}</p>
        {project.isSample ? (
          <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/40">
            Sample
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-white/45">{project.contactName}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/65">
          {project.stageLabel}
        </span>
        <span className="text-xs font-medium text-white/70">{formatCurrency(project.valueCents)}</span>
      </div>
    </motion.div>
  )
}

/* ────────────────────────── Empty state ────────────────────────── */

function EmptyState({
  title,
  subtitle,
  cta,
  primaryColor,
}: {
  title: string
  subtitle: string
  cta: string
  primaryColor: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-8 text-center">
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{subtitle}</p>
      <button
        type="button"
        disabled
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
        }}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {cta}
      </button>
    </div>
  )
}

/* ─────────────────────────── Primitives ─────────────────────────── */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-white/45">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  )
}

function PrimaryAction({
  icon: Icon,
  label,
  primaryColor,
}: {
  icon: LucideIcon
  label: string
  primaryColor: string
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
        boxShadow: `0 8px 24px -8px ${primaryColor}66, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
      className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium text-white"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </motion.button>
  )
}

function SecondaryAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-medium text-white/80 transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </motion.button>
  )
}
