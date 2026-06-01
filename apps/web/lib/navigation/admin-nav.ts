import type { FlagName } from '@/lib/feature-flags/flags'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart2,
  Bell,
  Brain,
  Building2,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileCheck,
  FileText,
  FolderKanban,
  FormInput,
  GitBranch,
  Handshake,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Mail,
  Megaphone,
  Package,
  PieChart,
  Plug,
  Rocket,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Telescope,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react'

export type AdminNavItem = {
  id: string
  label: string
  icon: LucideIcon
  /** When omitted, item is shown as coming soon (non-navigable). */
  href?: string
  badge?: number
  highlightLabel?: string
  flag?: FlagName
  tourAnchor?: string
}

export type AdminNavGroup = {
  id: string
  title: string
  items: AdminNavItem[]
}

/** Single source of truth for the Ventaro admin shell navigation (spec-aligned). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'command',
    title: 'Command',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
      { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/admin/inbox' },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/admin/calendar' },
    ],
  },
  {
    id: 'revenue',
    title: 'Revenue',
    items: [
      { id: 'leads', label: 'Leads', icon: UserPlus, href: '/admin/pipeline' },
      { id: 'deals', label: 'Deals', icon: Handshake, href: '/admin/pipeline', tourAnchor: 'nav-pipeline' },
      { id: 'contacts', label: 'Contacts', icon: Users, href: '/admin/clients' },
      { id: 'companies', label: 'Companies', icon: Building2 },
      { id: 'proposals', label: 'Proposals', icon: FileText },
      { id: 'meetings', label: 'Meetings', icon: Calendar },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'projects', label: 'Projects', icon: FolderKanban, href: '/admin/records' },
      { id: 'automations', label: 'Automations', icon: Zap, href: '/admin/automations' },
      { id: 'workflows', label: 'Workflows', icon: Workflow },
      { id: 'team-workload', label: 'Team Workload', icon: UsersRound },
      { id: 'sops', label: 'SOPs', icon: ClipboardList },
    ],
  },
  {
    id: 'client-experience',
    title: 'Client Experience',
    items: [
      { id: 'client-portal', label: 'Client Portal', icon: ExternalLink, href: '/admin/portal', tourAnchor: 'nav-portal' },
      { id: 'onboarding', label: 'Onboarding', icon: Rocket, href: '/admin/dashboard' },
      { id: 'deliverables', label: 'Deliverables', icon: Package, href: '/admin/deliverables' },
      { id: 'approvals', label: 'Approvals', icon: FileCheck },
      { id: 'billing', label: 'Billing', icon: CreditCard, href: '/admin/billing' },
      { id: 'support', label: 'Support', icon: LifeBuoy },
    ],
  },
  {
    id: 'growth',
    title: 'Growth',
    items: [
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone, href: '/admin/outreach/campaigns' },
      { id: 'email-marketing', label: 'Email Marketing', icon: Mail, href: '/admin/outreach/email' },
      { id: 'forms', label: 'Forms', icon: FormInput },
      { id: 'lead-sources', label: 'Lead Sources', icon: Link2 },
      { id: 'aspire', label: 'Aspire', icon: Telescope, href: '/admin/outreach/aspire' },
      { id: 'linkedin', label: 'LinkedIn', icon: Share2, href: '/admin/outreach/linkedin' },
      { id: 'analytics', label: 'Analytics', icon: PieChart, href: '/admin/reports' },
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    items: [
      { id: 'forecasting', label: 'Forecasting', icon: BarChart2, href: '/admin/forecasting', flag: 'executive_dashboard' },
      { id: 'client-health', label: 'Client Health', icon: HeartPulse, href: '/admin/clients' },
      { id: 'ai-insights', label: 'AI Insights', icon: Brain, href: '/admin/ai-brain' },
      { id: 'reports', label: 'Reports', icon: PieChart, href: '/admin/reports', flag: 'executive_dashboard' },
    ],
  },
]

export const ADMIN_NAV_FOOTER: AdminNavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'white-label', label: 'White Label', icon: Sparkles },
  { id: 'integrations', label: 'Integrations', icon: Plug, href: '/admin/integrations' },
]

/** Flat list of navigable routes for command palette / mobile shortcuts. */
export function getAvailableAdminNavItems(): AdminNavItem[] {
  const items = [
    ...ADMIN_NAV_GROUPS.flatMap((group) => group.items),
    ...ADMIN_NAV_FOOTER,
  ]
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.href || seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

export function resolveAdminPageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/dashboard')) return 'Dashboard'
  if (pathname.startsWith('/admin/clients')) return 'Contacts'
  if (pathname.startsWith('/admin/pipeline')) return 'Deals'
  if (pathname.startsWith('/admin/records')) return 'Projects'
  if (pathname.startsWith('/admin/inbox')) return 'Inbox'
  if (pathname.startsWith('/admin/calendar')) return 'Calendar'
  if (pathname.startsWith('/admin/outreach/aspire')) return 'Aspire'
  if (pathname.startsWith('/admin/outreach/linkedin')) return 'LinkedIn'
  if (pathname.startsWith('/admin/outreach/campaigns')) return 'Campaigns'
  if (pathname.startsWith('/admin/outreach/email')) return 'Email Marketing'
  if (pathname.startsWith('/admin/outreach')) return 'Growth'
  if (pathname.startsWith('/admin/ai-brain')) return 'AI Insights'
  if (pathname.startsWith('/admin/forecasting')) return 'Forecasting'
  if (pathname.startsWith('/admin/reports')) return 'Reports'
  if (pathname.startsWith('/admin/settings')) return 'Settings'
  if (pathname.startsWith('/admin/integrations')) return 'Integrations'
  if (pathname.startsWith('/admin/portal')) return 'Client Portal'
  if (pathname.startsWith('/admin/billing')) return 'Billing'
  if (pathname.startsWith('/admin/deliverables')) return 'Deliverables'
  if (pathname.startsWith('/admin/automations')) return 'Automations'

  const tail = pathname.split('/').filter(Boolean).pop() ?? 'Dashboard'
  return tail
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export type WorkspaceHeaderAction = {
  label: string
  onClick?: () => void
  href?: string
}

export function resolveWorkspacePrimaryAction(pathname: string): WorkspaceHeaderAction | null {
  if (pathname.startsWith('/admin/dashboard')) {
    return { label: 'Add client', href: '/admin/clients' }
  }
  if (pathname.startsWith('/admin/clients')) {
    return { label: 'New contact', href: '/admin/clients' }
  }
  if (pathname.startsWith('/admin/pipeline')) {
    return { label: 'New deal', href: '/admin/pipeline' }
  }
  if (pathname.startsWith('/admin/records')) {
    return { label: 'New project', href: '/admin/records' }
  }
  if (pathname.startsWith('/admin/outreach')) {
    return { label: 'New campaign', href: '/admin/outreach/campaigns' }
  }
  return null
}
