'use client'

import { adminLogoutAction } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  Brain,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Sliders,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  disabled?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/contacts', label: 'Contacts', icon: Users, disabled: true },
  { href: '/admin/pipeline', label: 'Pipeline', icon: TrendingUp, disabled: true },
  { href: '/admin/operations', label: 'Operations', icon: Wrench, disabled: true },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug, disabled: true },
  { href: '/admin/ai-brain', label: 'AI Agents', icon: Brain },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart, disabled: true },
  { href: '/admin/portal', label: 'Client Portal', icon: Sliders, disabled: true },
]

type Props = {
  businessName: string
  logoUrl: string | null
  email: string
  role: string
  primaryColor: string
}

export function AdminSidebar({ businessName, logoUrl, email, role, primaryColor }: Props) {
  const pathname = usePathname() ?? ''
  const initial = (businessName?.trim()?.[0] ?? 'V').toUpperCase()

  return (
    <aside className="relative hidden h-screen w-[240px] shrink-0 border-r border-white/[0.06] bg-[#0B1015] lg:sticky lg:top-0 lg:flex lg:flex-col">
      {/* Subtle radial glow at the top so the brand mark area feels lit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -top-24 size-[20rem] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: `radial-gradient(circle at center, ${primaryColor}, transparent 70%)` }}
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Brand mark */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${businessName} logo`}
              className="h-9 w-9 rounded-md bg-white/[0.04] object-contain p-1 ring-1 ring-inset ring-white/10"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.05] text-sm font-semibold text-white ring-1 ring-inset ring-white/10"
            >
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{businessName || 'Workspace'}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Admin</p>
          </div>
        </div>

        {/* Primary navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Primary">
          {PRIMARY_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <NavRow
                key={item.href}
                item={item}
                isActive={isActive}
                primaryColor={primaryColor}
              />
            )
          })}
        </nav>

        {/* Footer: user + sign out */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-white ring-1 ring-inset ring-white/10"
            >
              {(email?.[0] ?? 'U').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/90">{email}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-white/40">{role}</p>
            </div>
          </div>
          <form action={adminLogoutAction}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </form>
          <Link
            href="/admin/settings"
            className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
            aria-disabled
          >
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Settings
            <span className="ml-auto text-[9px] uppercase tracking-wider text-white/30">Soon</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}

function NavRow({
  item,
  isActive,
  primaryColor,
}: {
  item: NavItem
  isActive: boolean
  primaryColor: string
}) {
  const Icon = item.icon

  // Disabled items render as a plain div so the focus ring + nav semantics
  // don't promise interactivity that isn't there yet. Active items get a
  // pulsing emerald dot to telegraph "you are here" without leaning on color
  // alone (accessibility).
  const content = (
    <span
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive && 'bg-white/[0.05] text-white',
        !isActive && !item.disabled && 'text-white/55 hover:bg-white/[0.03] hover:text-white/90',
        item.disabled && 'cursor-not-allowed text-white/30',
      )}
    >
      <span aria-hidden className="relative flex h-2 w-2 items-center justify-center">
        {isActive ? (
          <>
            <motion.span
              className="absolute inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: '#10B981' }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{
                backgroundColor: '#10B981',
                boxShadow: '0 0 8px rgba(16,185,129,0.6)',
              }}
            />
          </>
        ) : (
          <span
            className={cn(
              'inline-flex h-1.5 w-1.5 rounded-full',
              item.disabled ? 'bg-white/15' : 'bg-white/25 group-hover:bg-white/45',
            )}
          />
        )}
      </span>

      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-white' : 'text-white/40',
          !isActive && !item.disabled && 'group-hover:text-white/80',
        )}
        aria-hidden
      />

      <span className="flex-1 truncate font-medium">{item.label}</span>

      {item.disabled ? (
        <span className="ml-auto rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/30">
          Soon
        </span>
      ) : null}

      {isActive ? (
        <span
          aria-hidden
          className="absolute inset-y-1 -left-3 w-0.5 rounded-full"
          style={{ backgroundColor: primaryColor }}
        />
      ) : null}
    </span>
  )

  if (item.disabled) {
    return <div aria-disabled="true">{content}</div>
  }

  return (
    <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
      {content}
    </Link>
  )
}
