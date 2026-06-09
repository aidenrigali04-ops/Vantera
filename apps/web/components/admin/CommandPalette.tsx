'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { FeatureGate } from '@/lib/feature-flags/gate-client'
import { useBranding } from '@/lib/branding/context'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import {
  getAvailableAdminNavItems,
  getDashboardHubs,
  getRoadmapAdminNavItems,
  getSidebarNavItems,
} from '@/lib/navigation/admin-nav'
import { useUIStore } from '@/lib/stores/ui-store'
import { Briefcase, CreditCard, TrendingUp, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const labels = useVerticalLabels()
  const { businessName } = useBranding()
  const { recentRoutes, pushRecentRoute } = useUIStore()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange])

  const navigate = (href: string) => {
    pushRecentRoute(href)
    router.push(href)
    onOpenChange(false)
  }

  const allNavItems = getAvailableAdminNavItems()
  const recentItems = recentRoutes
    .map((route) => allNavItems.find((item) => item.href === route))
    .filter(Boolean)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`Search ${businessName || 'workspace'}...`} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentItems.length > 0 ? (
          <>
            <CommandGroup heading="Recent">
              {recentItems.map((item) => {
                if (!item) return null
                const Icon = item.icon
                return (
                  <CommandItem key={`recent-${item.href}`} onSelect={() => navigate(item.href!)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Main areas">
          {getSidebarNavItems().map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} onSelect={() => navigate(item.href!)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>

        {getDashboardHubs().map((hub) => (
          <CommandGroup key={hub.id} heading={hub.title}>
            {[hub.primary, ...hub.related].map((link) => {
              const Icon = link.icon
              const item = (
                <CommandItem key={link.href} onSelect={() => navigate(link.href)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {link.label}
                </CommandItem>
              )

              if (link.flag) {
                return (
                  <FeatureGate key={link.href} flag={link.flag}>
                    {item}
                  </FeatureGate>
                )
              }

              return item
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => navigate('/admin/leads')}>
            <Users className="mr-2 h-4 w-4" />
            View pipeline
            <CommandShortcut>⇧C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/records?action=create')}>
            <Briefcase className="mr-2 h-4 w-4" />
            Create {labels.record.toLowerCase()}
            <CommandShortcut>⇧J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/leads')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Add lead
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/billing?action=invoice')}>
            <CreditCard className="mr-2 h-4 w-4" />
            New invoice
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Coming soon">
          {getRoadmapAdminNavItems().map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.id} disabled>
                <Icon className="mr-2 h-4 w-4 opacity-50" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/** Standalone hook for global Cmd+K registration outside the palette component. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpen])
}
