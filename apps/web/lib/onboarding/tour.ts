export type TourStepId =
  | 'action_feed'
  | 'pipeline_revenue'
  | 'prospect_pipeline'
  | 'client_portal'

export type TourStep = {
  id: TourStepId
  message: string
  /** CSS selector for anchor element; tooltip positions below it. */
  anchor: string
}

export type TourContext = {
  pathname: string
  actionFeedDelayElapsed: boolean
  pipelineSectionVisible: boolean
}

export const TOUR_STEPS: Record<TourStepId, TourStep> = {
  action_feed: {
    id: 'action_feed',
    message:
      'This is your command center. It tells you what needs attention right now — not a chart.',
    anchor: '[data-tour="action-feed"]',
  },
  pipeline_revenue: {
    id: 'pipeline_revenue',
    message:
      'Your entire pipeline. Click any opportunity to see its history, tasks, and next steps.',
    anchor: '[data-tour="dashboard-pipeline"]',
  },
  prospect_pipeline: {
    id: 'prospect_pipeline',
    message:
      'Before a contact becomes a client, they live here. One system — from prospect to delivery.',
    anchor: '[data-tour="pipeline-leads"]',
  },
  client_portal: {
    id: 'client_portal',
    message:
      'Your clients see this. Project progress, files, approvals — all in one place.',
    anchor: '[data-tour="nav-portal"]',
  },
}

/** Priority when multiple steps are eligible — only one shows at a time. */
export const TOUR_STEP_ORDER: TourStepId[] = [
  'action_feed',
  'pipeline_revenue',
  'prospect_pipeline',
  'client_portal',
]

export function tourStepStorageKey(accountId: string, stepId: TourStepId): string {
  return `vantera_tour_seen_${accountId}_${stepId}`
}

export function isTourStepSeen(accountId: string, stepId: TourStepId): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(tourStepStorageKey(accountId, stepId)) === 'true'
}

export function markTourStepSeen(accountId: string, stepId: TourStepId): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(tourStepStorageKey(accountId, stepId), 'true')
}

function isStepEligible(accountId: string, id: TourStepId, ctx: TourContext): boolean {
  if (isTourStepSeen(accountId, id)) return false

  switch (id) {
    case 'action_feed':
      return ctx.pathname === '/admin/dashboard' && ctx.actionFeedDelayElapsed
    case 'pipeline_revenue':
      return ctx.pathname === '/admin/dashboard' && ctx.pipelineSectionVisible
    case 'prospect_pipeline':
      return ctx.pathname.startsWith('/admin/crm/pipeline')
    case 'client_portal':
      return ctx.pathname.startsWith('/admin/portal')
    default:
      return false
  }
}

export function isTourStepEligible(accountId: string, id: TourStepId, ctx: TourContext): boolean {
  return isStepEligible(accountId, id, ctx)
}

export function nextEligibleTourStep(accountId: string, ctx: TourContext): TourStepId | null {
  for (const id of TOUR_STEP_ORDER) {
    if (isStepEligible(accountId, id, ctx)) return id
  }
  return null
}
