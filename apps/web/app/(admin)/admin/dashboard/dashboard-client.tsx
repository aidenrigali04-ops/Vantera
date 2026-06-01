'use client'

import { DashboardEmbeddedInsights } from '@/components/dashboard/DashboardEmbeddedInsights'
import { DashboardClientHealthPanel } from '@/components/dashboard/DashboardClientHealthPanel'
import { DashboardKpiSection } from '@/components/dashboard/DashboardKpiSection'
import { DashboardPipelineSnapshot } from '@/components/dashboard/DashboardPipelineSnapshot'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { DashboardTeamWorkloadPanel } from '@/components/dashboard/DashboardTeamWorkloadPanel'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import { ExploreGuideRail } from '@/components/onboarding/ExploreGuideRail'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { onboardingSuccessStorageKey } from '@/lib/import/fields'
import { useOperatingModel } from '@/lib/onboarding/use-operating-model'
import { DURATION, EASE_OUT } from '@/lib/motion'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { DashboardActionFeed } from './DashboardActionFeed'

type DashboardClientProps = {
  email: string
  role: string
  businessName: string
  primaryColor: string
  snapshot: DashboardSnapshot
  actionFeed: ActionFeedItem[]
  accountId: string
  onboardingIncomplete?: boolean
  embeddedInsights?: EmbeddedInsight[]
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.page, ease: EASE_OUT },
  },
}

export function DashboardClient({
  email,
  businessName,
  snapshot,
  actionFeed,
  accountId,
  onboardingIncomplete = false,
  embeddedInsights = [],
}: DashboardClientProps) {
  const reduceMotion = useReducedMotion()
  const operatingModel = useOperatingModel(accountId)
  const { isEmpty } = snapshot
  const showCleanSlate = isEmpty && onboardingIncomplete
  const showDemoGuide = onboardingIncomplete && !showCleanSlate
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

  const greeting = useMemo(() => {
    if (showCleanSlate) return 'Your workspace is ready'
    if (onboardingIncomplete) return `Explore ${businessName || 'your demo workspace'}`
    return `Good to see you, ${firstNameFromEmail(email)}`
  }, [businessName, email, onboardingIncomplete, showCleanSlate])

  const subline = useMemo(() => {
    if (showCleanSlate) {
      return 'Pipeline, clients, and delivery views are configured. Add your first client to bring the system online.'
    }
    if (onboardingIncomplete) {
      return operatingModel.dashboardSubline
    }
    return 'Here is what needs momentum across revenue, delivery, and client health.'
  }, [onboardingIncomplete, operatingModel.dashboardSubline, showCleanSlate])

  return (
    <motion.div
      className="space-y-6"
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: reduceMotion ? 0 : 0.05, delayChildren: 0.02 },
        },
      }}
    >
      {showCleanSlate ? (
        <motion.div variants={fadeUp}>
          <CleanSlateWelcome />
        </motion.div>
      ) : (
        <motion.header variants={fadeUp} className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
            {onboardingIncomplete ? 'Demo workspace' : 'Command center'}
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-[1.75rem]">
            {greeting}
          </h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-stone-500">{subline}</p>
        </motion.header>
      )}

      <div
        className={
          showDemoGuide
            ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start'
            : undefined
        }
      >
        <div className="space-y-6">
          <motion.div variants={fadeUp}>
            <DashboardKpiSection
              snapshot={snapshot}
              actionFeed={actionFeed}
              gettingStarted={showCleanSlate}
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <DashboardActionFeed
              items={actionFeed}
              successNotice={successNotice}
              onDismissSuccessNotice={dismissSuccessNotice}
              emptyMessage={
                showCleanSlate
                  ? "Your workspace is ready. Let's add your first client."
                  : undefined
              }
            />
          </motion.div>

          {!showCleanSlate && embeddedInsights.length > 0 ? (
            <motion.div variants={fadeUp}>
              <DashboardEmbeddedInsights insights={embeddedInsights} />
            </motion.div>
          ) : null}

          <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-2">
            <DashboardSection
              title="Pipeline snapshot"
              subtitle="Open opportunities by stage"
              action={{ label: 'View pipeline', href: '/admin/pipeline' }}
              tourAnchor="dashboard-pipeline"
            >
              <DashboardPipelineSnapshot deals={snapshot.deals} showCleanSlate={showCleanSlate} />
            </DashboardSection>

            <DashboardSection
              title="Client health"
              subtitle="Accounts that may need a check-in"
              action={{ label: 'View contacts', href: '/admin/clients' }}
            >
              <DashboardClientHealthPanel clients={snapshot.clients} />
            </DashboardSection>
          </motion.div>

          <motion.div variants={fadeUp}>
            <DashboardSection
              title="Team workload"
              subtitle="Overdue tasks and active delivery"
              action={{ label: 'View tasks', href: '/admin/pipeline' }}
            >
              <DashboardTeamWorkloadPanel projects={snapshot.projects} actionFeed={actionFeed} />
            </DashboardSection>
          </motion.div>
        </div>

        {showDemoGuide ? (
          <motion.aside variants={fadeUp} className="xl:sticky xl:top-6">
            <ExploreGuideRail accountId={accountId} businessName={businessName} />
          </motion.aside>
        ) : null}
      </div>
    </motion.div>
  )
}
