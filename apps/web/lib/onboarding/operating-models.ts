import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Building2,
  Handshake,
  Rocket,
  Target,
  Users,
} from 'lucide-react'

export type OperatingModelId =
  | 'agency_ops'
  | 'client_delivery'
  | 'saas_onboarding'
  | 'consulting'
  | 'recruiting'
  | 'sales_pipeline'

export type OperatingModelVertical =
  | 'agency'
  | 'construction'
  | 'property_mgmt'
  | 'real_estate'

export type OperatingModel = {
  id: OperatingModelId
  label: string
  description: string
  vertical: OperatingModelVertical
  icon: LucideIcon
  accent: string
  dashboardSubline: string
  exploreIntro: string
  exploreSteps: Array<{ id: string; title: string; body: string; href: string }>
}

/** Platform-spec operating models — maps to existing vertical templates + labels. */
export const OPERATING_MODELS: OperatingModel[] = [
  {
    id: 'agency_ops',
    label: 'Agency operations',
    description: 'Campaigns, retainers, and client ROI across delivery teams',
    vertical: 'agency',
    icon: Briefcase,
    accent: '#EC4899',
    dashboardSubline:
      'Track clients, pipeline, and delivery in one operating rhythm built for agency work.',
    exploreIntro:
      'Sample clients and deals show how retainers, campaigns, and delivery connect in one system.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'See your command center',
        body: 'Action Feed surfaces what needs attention across clients and revenue.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'Review active clients',
        body: 'Health, records, and communication history live on each account.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Follow proposals & deals',
        body: 'Move opportunities from nurture to signed without switching tools.',
        href: '/admin/pipeline',
      },
    ],
  },
  {
    id: 'client_delivery',
    label: 'Client delivery',
    description: 'Projects, milestones, and fulfillment for service businesses',
    vertical: 'construction',
    icon: Building2,
    accent: '#F59E0B',
    dashboardSubline:
      'Coordinate active projects, client health, and overdue work from one calm workspace.',
    exploreIntro:
      'Explore how projects, clients, and pipeline stages link together during delivery.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'Monitor delivery',
        body: 'See overdue tasks, project progress, and client health at a glance.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'Open client records',
        body: 'Every engagement ties back to the client and their active work.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Track proposals',
        body: 'Pre-delivery opportunities stay connected until they become projects.',
        href: '/admin/pipeline',
      },
    ],
  },
  {
    id: 'saas_onboarding',
    label: 'SaaS onboarding',
    description: 'Customer activation, milestones, and expansion motion',
    vertical: 'agency',
    icon: Rocket,
    accent: '#6366F1',
    dashboardSubline:
      'Run onboarding, health checks, and expansion signals for product-led customers.',
    exploreIntro:
      'Walk through how customer accounts, onboarding projects, and pipeline connect.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'Watch activation',
        body: 'Spot stalled onboarding and expansion signals in the Action Feed.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'Browse customer accounts',
        body: 'Lifecycle, health scores, and portal activity on each account.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Manage expansion',
        body: 'Upsell and renewal opportunities stay tied to active customers.',
        href: '/admin/pipeline',
      },
    ],
  },
  {
    id: 'consulting',
    label: 'Consulting',
    description: 'Engagements, deliverables, and partner-led client work',
    vertical: 'agency',
    icon: Handshake,
    accent: '#0D9488',
    dashboardSubline:
      'Keep engagements, deliverables, and client relationships aligned without chaos.',
    exploreIntro:
      'See how consulting engagements flow from pipeline to active client delivery.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'Stay on top of work',
        body: 'Overdue follow-ups and client risk surface automatically.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'Review engagements',
        body: 'Each client ties to proposals, projects, and activity history.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Qualify new work',
        body: 'Prospects move through stages until they become active clients.',
        href: '/admin/pipeline',
      },
    ],
  },
  {
    id: 'recruiting',
    label: 'Recruiting',
    description: 'Candidates, placements, and hiring pipeline management',
    vertical: 'real_estate',
    icon: Users,
    accent: '#8B5CF6',
    dashboardSubline:
      'Manage candidates, placements, and pipeline momentum in one structured system.',
    exploreIntro:
      'Explore how leads, clients, and pipeline stages map to a recruiting workflow.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'Prioritize today',
        body: 'See stalled candidates and follow-ups in the Action Feed.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'View placements',
        body: 'Active relationships and records stay organized per client.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Work the pipeline',
        body: 'Leads move through stages until they convert to active clients.',
        href: '/admin/pipeline',
      },
    ],
  },
  {
    id: 'sales_pipeline',
    label: 'Sales pipelines',
    description: 'Prospects, deals, and revenue motion for outbound teams',
    vertical: 'real_estate',
    icon: Target,
    accent: '#EF4444',
    dashboardSubline:
      'Run pipeline discipline from first touch through closed revenue.',
    exploreIntro:
      'Click through sample deals and leads to see a unified sales operating system.',
    exploreSteps: [
      {
        id: 'dashboard',
        title: 'Drive momentum',
        body: 'Stalled deals and replies show up where you act every day.',
        href: '/admin/dashboard',
      },
      {
        id: 'clients',
        title: 'Convert to clients',
        body: 'Won deals become active accounts with full history preserved.',
        href: '/admin/clients',
      },
      {
        id: 'pipeline',
        title: 'Manage prospects',
        body: 'Qualify, nurture, and convert without leaving the table.',
        href: '/admin/pipeline',
      },
    ],
  },
]

export function getOperatingModel(id: string | null | undefined): OperatingModel | null {
  if (!id) return null
  return OPERATING_MODELS.find((model) => model.id === id) ?? null
}

export function getDefaultOperatingModel(): OperatingModel {
  return OPERATING_MODELS[0]!
}
