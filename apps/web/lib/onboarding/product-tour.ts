import type { LucideIcon } from 'lucide-react'

export type ProductTourPreviewId =
  | 'welcome'
  | 'priorities'
  | 'navigation'
  | 'clients'
  | 'pipeline'
  | 'projects'
  | 'intelligence'
  | 'finish'

export type ProductTourMedia =
  | { type: 'preview'; previewId: ProductTourPreviewId }
  | { type: 'image'; src: string; alt: string }
  | { type: 'video'; src: string; alt: string; poster?: string }

export type ProductTourSlide = {
  id: string
  eyebrow: string
  title: string
  /** One glance — keep under ~10 words. */
  body: string
  media: ProductTourMedia
}

export const PRODUCT_TOUR_SLIDES: ProductTourSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'Welcome',
    title: 'Your operating system, one screen',
    body: 'Dashboard first. Everything else grouped around it.',
    media: { type: 'preview', previewId: 'welcome' },
  },
  {
    id: 'priorities',
    eyebrow: 'Step 1',
    title: 'Start with today’s priorities',
    body: 'Urgent actions surface here — not buried in charts.',
    media: { type: 'preview', previewId: 'priorities' },
  },
  {
    id: 'navigation',
    eyebrow: 'Step 2',
    title: 'Four areas in the sidebar',
    body: 'Clients · Pipeline · Projects · Dashboard. That’s the map.',
    media: { type: 'preview', previewId: 'navigation' },
  },
  {
    id: 'clients',
    eyebrow: 'Clients',
    title: 'Relationships and client experience',
    body: 'Contacts, portal, and billing live in one group.',
    media: { type: 'preview', previewId: 'clients' },
  },
  {
    id: 'pipeline',
    eyebrow: 'Pipeline',
    title: 'Revenue from first touch to close',
    body: 'Deals plus outreach tools — Aspire, LinkedIn, campaigns.',
    media: { type: 'preview', previewId: 'pipeline' },
  },
  {
    id: 'projects',
    eyebrow: 'Projects',
    title: 'Delivery stays on track',
    body: 'Projects, deliverables, and automations together.',
    media: { type: 'preview', previewId: 'projects' },
  },
  {
    id: 'intelligence',
    eyebrow: 'Intelligence',
    title: 'AI tells you what to do next',
    body: 'Insights and reports without digging through data.',
    media: { type: 'preview', previewId: 'intelligence' },
  },
  {
    id: 'finish',
    eyebrow: 'You’re set',
    title: 'Explore the demo workspace',
    body: 'Click around freely — swap in your data when ready.',
    media: { type: 'preview', previewId: 'finish' },
  },
]

export const PRODUCT_TOUR_REQUEST_EVENT = 'vantera:product-tour-open'
export const PRODUCT_TOUR_COMPLETED_EVENT = 'vantera:product-tour-completed'

export function productTourStorageKey(accountId: string): string {
  return `vantera_product_tour_complete_${accountId}`
}

export function isProductTourComplete(accountId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(productTourStorageKey(accountId)) === 'true'
}

export function markProductTourComplete(accountId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(productTourStorageKey(accountId), 'true')
  window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_COMPLETED_EVENT, { detail: { accountId } }))
}

export function clearProductTourComplete(accountId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(productTourStorageKey(accountId))
}

export function requestProductTourReplay(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_REQUEST_EVENT))
}

/** Drop PNG/WebM files in `public/tour/` and swap preview media for image/video entries. */
export const PRODUCT_TOUR_ASSET_EXAMPLES = {
  prioritiesImage: '/tour/priorities.png',
  pipelineVideo: '/tour/pipeline-overview.webm',
} as const

export type ProductTourSlideMeta = {
  index: number
  total: number
  isFirst: boolean
  isLast: boolean
}

export function getProductTourSlideMeta(index: number): ProductTourSlideMeta {
  const total = PRODUCT_TOUR_SLIDES.length
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
  }
}

export type ProductTourNavIcon = LucideIcon
