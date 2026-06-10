import type { FlagName } from '@/lib/feature-flags/flags'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart2,
  Bell,
  Bot,
  Calendar,
  CheckSquare,
  ClipboardList,
  Cpu,
  CreditCard,
  FileCheck,
  FileText,
  FolderKanban,
  FormInput,
  GitBranch,
  Handshake,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Link2,
  Mail,
  Megaphone,
  Package,
  PieChart,
  Plug,
  Send,
  Settings,
  Share2,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react'

export type AdminNavItem = {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  badge?: number
  highlightLabel?: string
  flag?: FlagName
  tourAnchor?: string
}

export type AdminNavHubLink = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  flag?: FlagName
  tourAnchor?: string
}

export type AdminNavHub = {
  id: string
  title: string
  description: string
  /** When set, this area’s main route is already in the sidebar. */
  sidebarId?: string
  primary: AdminNavHubLink
  related: AdminNavHubLink[]
}

/** Sidebar — primary destinations per the Figma tab bar. */
export const ADMIN_NAV_SIDEBAR: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, href: '/admin/dashboard' },
  { id: 'agent', label: 'Agents', icon: Cpu, href: '/admin/sdr-agents', tourAnchor: 'nav-agents' },
  { id: 'outreach', label: 'Outreach', icon: Send, href: '/admin/outreach/campaigns', tourAnchor: 'nav-outreach' },
  { id: 'integrations', label: 'Integrations', icon: Layers, href: '/admin/integrations' },
]

/**
 * Secondary sidebar links — workspace destinations outside the Figma tab bar.
 * Channels (LinkedIn/Email/SMS) are attributes of a sequence, not
 * destinations — they live as tabs inside Agent/Campaigns.
 */
export const ADMIN_NAV_SIDEBAR_SECONDARY: AdminNavItem[] = [
  { id: 'pipeline', label: 'Pipeline', icon: FolderKanban, href: '/admin/leads', tourAnchor: 'nav-pipeline' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/admin/inbox' },
]

/**
 * Grouped areas shown on the dashboard — one primary CTA per hub plus compact related links.
 */
export const ADMIN_NAV_HUBS: AdminNavHub[] = [
  {
    id: 'agent',
    title: 'SDR Agent',
    description: 'Your autonomous agent — it prospects, profiles, writes the copy, and runs multi-channel sequences.',
    sidebarId: 'agent',
    primary: { id: 'agent-overview', label: 'Open agent', href: '/admin/sdr-agents', icon: Bot },
    related: [
      { id: 'agent-setup', label: 'Setup', href: '/admin/outreach/agents/setup', icon: Settings },
      { id: 'agent-sequences', label: 'Sequences', href: '/admin/outreach/agents/sequences', icon: Workflow },
    ],
  },
  {
    id: 'outreach',
    title: 'Campaigns',
    description: 'Build and launch manual multi-channel campaigns — LinkedIn, email, and SMS.',
    sidebarId: 'outreach',
    primary: { id: 'campaigns', label: 'Campaigns', href: '/admin/outreach/campaigns', icon: Megaphone },
    related: [
      { id: 'linkedin', label: 'LinkedIn', href: '/admin/outreach/linkedin', icon: Share2 },
      { id: 'email', label: 'Email', href: '/admin/outreach/email', icon: Mail },
    ],
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Every lead across stages — see what is moving and what needs attention.',
    sidebarId: 'pipeline',
    primary: { id: 'pipeline-open', label: 'Open pipeline', href: '/admin/leads', icon: FolderKanban },
    related: [],
  },
]

export const ADMIN_NAV_FOOTER: AdminNavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
  { id: 'help', label: 'Help Center', icon: LifeBuoy, href: '/admin/help' },
]

/** Roadmap — command palette only. */
export const ADMIN_NAV_ROADMAP: AdminNavItem[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'leads-nav', label: 'Lead inbox', icon: UserPlus },
  { id: 'companies', label: 'Companies', icon: UsersRound },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'meetings', label: 'Meetings', icon: Calendar },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'team-workload', label: 'Team workload', icon: UsersRound },
  { id: 'sops', label: 'SOPs', icon: ClipboardList },
  { id: 'approvals', label: 'Approvals', icon: FileCheck },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'forms', label: 'Forms', icon: FormInput },
  { id: 'lead-sources', label: 'Lead sources', icon: Link2 },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'white-label', label: 'White label', icon: Sparkles },
  { id: 'git-tools', label: 'Version control', icon: GitBranch },
]

/** @deprecated */
export const ADMIN_NAV_PRIMARY = ADMIN_NAV_SIDEBAR
/** @deprecated */
export const ADMIN_NAV_MORE_GROUPS: { id: string; title: string; items: AdminNavItem[] }[] = []

export function isAdminNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard'
  return pathname.startsWith(`${href}/`)
}

/** Sidebar highlight — active for the whole hub, not just the primary route. */
export function isSidebarItemActive(pathname: string, item: AdminNavItem): boolean {
  if (!item.href) return false

  // The Agent area spans the SDR agent surface and the agent sub-pages.
  if (item.id === 'agent') {
    return pathname.startsWith('/admin/sdr-agents') || pathname.startsWith('/admin/outreach/agents')
  }

  if (item.id === 'pipeline') {
    return pathname.startsWith('/admin/leads')
  }

  if (item.id === 'integrations') {
    return pathname.startsWith('/admin/integrations')
  }

  if (item.id === 'settings' && item.href) {
    if (pathname.startsWith('/admin/billing')) return true
    return isAdminNavItemActive(pathname, item.href)
  }

  // Campaigns own all of /admin/outreach except the Agent sub-pages.
  if (item.id === 'outreach' && pathname.startsWith('/admin/outreach')) {
    if (pathname.startsWith('/admin/outreach/agents')) return false
    return true
  }

  const hub = ADMIN_NAV_HUBS.find((entry) => entry.sidebarId === item.id)
  if (hub) {
    return [hub.primary, ...hub.related].some(
      (link) => link.href && isAdminNavItemActive(pathname, link.href),
    )
  }

  return isAdminNavItemActive(pathname, item.href)
}

export function isPathInHubNav(pathname: string): boolean {
  return ADMIN_NAV_HUBS.some((hub) =>
    [hub.primary, ...hub.related].some(
      (link) => link.href && isAdminNavItemActive(pathname, link.href),
    ),
  )
}

/** @deprecated */
export function isPathInMoreNav(pathname: string): boolean {
  return isPathInHubNav(pathname)
}

export function getMobileNavItems(): AdminNavItem[] {
  return ADMIN_NAV_SIDEBAR
}

export function getSidebarNavItems(): AdminNavItem[] {
  return ADMIN_NAV_SIDEBAR
}

export function getDashboardHubs(): AdminNavHub[] {
  return ADMIN_NAV_HUBS
}

export function getAvailableAdminNavItems(): AdminNavItem[] {
  const fromHubs = ADMIN_NAV_HUBS.flatMap((hub) =>
    [hub.primary, ...hub.related].map((link) => ({
      id: link.id,
      label: link.label,
      icon: link.icon,
      href: link.href,
      flag: link.flag,
      tourAnchor: link.tourAnchor,
    })),
  )

  const items = [...ADMIN_NAV_SIDEBAR, ...ADMIN_NAV_SIDEBAR_SECONDARY, ...fromHubs, ...ADMIN_NAV_FOOTER]
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.href || seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

export function getPrimaryAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_SIDEBAR
}

export function getMoreAdminNavGroups(): { id: string; title: string; items: AdminNavItem[] }[] {
  return ADMIN_NAV_HUBS.map((hub) => ({
    id: hub.id,
    title: hub.title,
    items: [hub.primary, ...hub.related].map((link) => ({
      id: link.id,
      label: link.label,
      icon: link.icon,
      href: link.href,
      flag: link.flag,
      tourAnchor: link.tourAnchor,
    })),
  }))
}

export function getRoadmapAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_ROADMAP
}

export function resolveAdminPageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/dashboard')) return 'Home'
  if (pathname.startsWith('/admin/leads')) return 'Pipeline'
  if (pathname.startsWith('/admin/sdr-agents')) return 'Agent'
  if (pathname.startsWith('/admin/outreach/aspire')) return 'Prospects'
  if (pathname.startsWith('/admin/outreach/agents/scout')) return 'Scout Agent'
  if (pathname.startsWith('/admin/outreach/agents/drafter')) return 'Drafter Agent'
  if (pathname.startsWith('/admin/outreach/agents/outreach')) return 'Outreach Agent'
  if (pathname.startsWith('/admin/outreach/agents/sequences')) return 'Sequences'
  if (pathname.startsWith('/admin/outreach/agents')) return 'Agents'
  if (pathname.startsWith('/admin/outreach/linkedin')) return 'LinkedIn'
  if (pathname.startsWith('/admin/outreach/email')) return 'Email'
  if (pathname.startsWith('/admin/outreach/campaigns')) return 'Campaigns'
  if (pathname.startsWith('/admin/outreach')) return 'Outreach'
  if (pathname.startsWith('/admin/inbox')) return 'Inbox'
  if (pathname.startsWith('/admin/help')) return 'Help Center'
  if (pathname.startsWith('/admin/settings')) return 'Settings'
  if (pathname.startsWith('/admin/integrations')) return 'Integrations'
  if (pathname.startsWith('/admin/billing')) return 'Billing'
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
    return { label: 'Open agent', href: '/admin/sdr-agents' }
  }
  if (pathname.startsWith('/admin/sdr-agents') || pathname.startsWith('/admin/outreach/agents')) {
    return { label: 'Configure agent', href: '/admin/outreach/agents/setup' }
  }
  if (pathname.startsWith('/admin/outreach/campaigns')) {
    return { label: 'New campaign', href: '/admin/outreach/campaigns' }
  }
  if (pathname.startsWith('/admin/outreach')) {
    return { label: 'Open agents', href: '/admin/outreach/agents' }
  }
  if (pathname.startsWith('/admin/integrations')) {
    return { label: 'Connect channels', href: '/admin/integrations' }
  }
  return null
}

export function resolveHubForPath(pathname: string): AdminNavHub | null {
  return (
    ADMIN_NAV_HUBS.find((hub) =>
      [hub.primary, ...hub.related].some(
        (link) => link.href && isAdminNavItemActive(pathname, link.href),
      ),
    ) ?? null
  )
}
