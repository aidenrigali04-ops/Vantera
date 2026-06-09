'use client'

import { SdrAgentIcon } from '@/components/agents/SdrAgentIcon'
import type { SdrAgentIconName } from '@/lib/agents/types'
import { cn } from '@/lib/utils'
import { Mail, MessageCircle, Radar, Link2 } from 'lucide-react'
import type { ReactNode } from 'react'

type ConnectedAppIcon = 'mail' | 'sms' | 'linkedin' | 'explorium'

type ConnectedApp = {
  id: string
  name: string
  icon: ConnectedAppIcon | ReactNode
}

const ICON_MAP = {
  mail: Mail,
  sms: MessageCircle,
  linkedin: Link2,
  explorium: Radar,
} as const

type Props = {
  instructions: string
  connectedApps?: ConnectedApp[]
  agentIcon?: SdrAgentIconName
}

export function AgentSidebarPanel({ instructions, connectedApps = [], agentIcon }: Props) {
  return (
    <>
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Agent instructions</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">{instructions}</p>
      </section>

      {connectedApps.length > 0 ? (
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Connected apps</h2>
          <ul className="mt-3 space-y-2">
            {connectedApps.map((app) => {
              const LucideIcon =
                typeof app.icon === 'string' ? ICON_MAP[app.icon as ConnectedAppIcon] : null
              return (
                <li
                  key={app.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-3 py-2.5"
                >
                  <span className="icon-tile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)]">
                    {LucideIcon ? (
                      <LucideIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    ) : agentIcon && app.id === 'scout' ? (
                      <SdrAgentIcon name={agentIcon} className="h-4 w-4" />
                    ) : (
                      app.icon
                    )}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{app.name}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </>
  )
}

export const DEFAULT_SDR_CONNECTED_APPS: ConnectedApp[] = [
  { id: 'explorium', name: 'Explorium lead discovery', icon: 'explorium' },
  { id: 'resend', name: 'Resend email', icon: 'mail' },
  { id: 'twilio', name: 'Twilio SMS', icon: 'sms' },
  { id: 'linkedin', name: 'LinkedIn add-on', icon: 'linkedin' },
]
