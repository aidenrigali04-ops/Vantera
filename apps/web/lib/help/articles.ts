import type { LucideIcon } from 'lucide-react'
import { Link2, LifeBuoy, Mail, Plug } from 'lucide-react'

export type HelpArticleId = 'overview' | 'linkedin-outreach' | 'email-outreach' | 'integrations'

export type HelpArticleMeta = {
  id: HelpArticleId
  title: string
  description: string
  icon: LucideIcon
  /** In-app route when the article is a link-out rather than inline content */
  externalHref?: string
}

export const HELP_ARTICLES: HelpArticleMeta[] = [
  {
    id: 'overview',
    title: 'Help Center',
    description: 'Guides for outreach, LinkedIn, email, and workspace setup.',
    icon: LifeBuoy,
  },
  {
    id: 'linkedin-outreach',
    title: 'Set up LinkedIn outreach',
    description: 'Connect the add-on, add prospects, launch campaigns, and send connection notes.',
    icon: Link2,
  },
  {
    id: 'email-outreach',
    title: 'Set up email outreach',
    description: 'Domain DNS, sending identity, and automated email sequences.',
    icon: Mail,
    externalHref: '/admin/integrations?section=email',
  },
  {
    id: 'integrations',
    title: 'Integrations & imports',
    description: 'CRM connections, imports, and workspace tools.',
    icon: Plug,
    externalHref: '/admin/integrations',
  },
]

export function normalizeHelpArticleId(value: string | null | undefined): HelpArticleId {
  if (value === 'linkedin-outreach') return 'linkedin-outreach'
  if (value === 'email-outreach') return 'email-outreach'
  if (value === 'integrations') return 'integrations'
  return 'overview'
}

export function findHelpArticle(id: HelpArticleId): HelpArticleMeta {
  return HELP_ARTICLES.find((a) => a.id === id) ?? HELP_ARTICLES[0]!
}
