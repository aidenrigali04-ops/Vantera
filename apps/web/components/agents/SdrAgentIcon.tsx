'use client'

import type { SdrAgentIconName } from '@/lib/agents/types'
import { Brain, Megaphone, PenLine, Telescope, type LucideIcon } from 'lucide-react'

const ICONS: Record<SdrAgentIconName, LucideIcon> = {
  telescope: Telescope,
  megaphone: Megaphone,
  'pen-line': PenLine,
  brain: Brain,
}

type Props = {
  name: SdrAgentIconName
  className?: string
}

export function SdrAgentIcon({ name, className }: Props) {
  const Icon = ICONS[name]
  return <Icon className={className} aria-hidden />
}
