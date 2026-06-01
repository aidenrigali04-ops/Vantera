'use client'

import { DraftReviewSheet } from '@/components/dashboard/DraftReviewSheet'
import { DashboardEmbeddedInsights } from '@/components/dashboard/DashboardEmbeddedInsights'
import { DashboardKpiSection } from '@/components/dashboard/DashboardKpiSection'
import { DashboardOverviewCollapsible } from '@/components/dashboard/DashboardOverviewCollapsible'
import { DashboardWorkspaceHubs } from '@/components/dashboard/DashboardWorkspaceHubs'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import { ExploreGuideStrip } from '@/components/onboarding/ExploreGuideStrip'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { onboardingSuccessStorageKey } from '@/lib/import/fields'
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
  businessName: _businessName,
  snapshot,
  actionFeed,
  accountId,
  onboardingIncomplete = false,
  embeddedInsights = [],
}: DashboardClientProps) {
  const reduceMotion = useReducedMotion()
  const { isEmpty } = snapshot
  const showCleanSlate = isEmpty && onboardingIncomplete
  const showDemoGuide = onboardingIncomplete && !showCleanSlate
  const [successNotice, setSuccessNotice] = useState<OnboardingSuccessNotice | null>(null)
  const [reviewDraftId, setReviewDraftId] = useState<string | null>(null)

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
    if (showCleanSlate) return null
    if (onboardingIncomplete) return 'See how Ventaro runs your business'
    return `Good to see you, ${firstNameFromEmail(email)}`
  }, [email, onboardingIncomplete, showCleanSlate])

  const subline = useMemo(() => {
    if (showCleanSlate) return null
    if (onboardingIncomplete) {
      return 'Sample data shows what your day looks like — start with today’s priorities, then explore when you’re ready.'
    }
    return 'Your priorities first — then pick an area below. The sidebar stays simple on purpose.'
  }, [onboardingIncomplete, showCleanSlate])

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
        <>
          <motion.div variants={fadeUp}>
            <CleanSlateWelcome />
          </motion.div>
          <motion.div variants={fadeUp}>
            <DashboardWorkspaceHubs />
          </motion.div>
        </>
      ) : (
        <>
          <motion.header variants={fadeUp} className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-[1.75rem]">
              {greeting}
            </h1>
            {subline ? (
              <p className="max-w-2xl text-[13px] leading-relaxed text-stone-500">{subline}</p>
            ) : null}
          </motion.header>

          <motion.div variants={fadeUp}>
            <DashboardActionFeed
              items={actionFeed}
              successNotice={successNotice}
              onDismissSuccessNotice={dismissSuccessNotice}
              onReviewDraft={setReviewDraftId}
              maxVisible={5}
            />
            <DraftReviewSheet
              draftId={reviewDraftId}
              onClose={() => setReviewDraftId(null)}
              onActionComplete={() => window.location.reload()}
            />
          </motion.div>

          {showDemoGuide ? (
            <motion.div variants={fadeUp}>
              <ExploreGuideStrip accountId={accountId} />
            </motion.div>
          ) : null}

          <motion.div variants={fadeUp}>
            <DashboardWorkspaceHubs />
          </motion.div>

          <motion.div variants={fadeUp}>
            <DashboardKpiSection snapshot={snapshot} actionFeed={actionFeed} />
          </motion.div>

          {!showCleanSlate && embeddedInsights.length > 0 ? (
            <motion.div variants={fadeUp}>
              <DashboardEmbeddedInsights insights={embeddedInsights} />
            </motion.div>
          ) : null}

          <motion.div variants={fadeUp}>
            <DashboardOverviewCollapsible
              snapshot={snapshot}
              actionFeed={actionFeed}
              defaultOpen={!onboardingIncomplete}
            />
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
