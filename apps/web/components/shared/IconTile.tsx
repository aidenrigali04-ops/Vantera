'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ElementType } from 'react'

type IconComponent = LucideIcon | ElementType

type Size = 'xs' | 'sm' | 'md' | 'lg'

const TILE_SIZE: Record<Size, string> = {
  xs: 'h-7 w-7 rounded-md',
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
}

const ICON_SIZE: Record<Size, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
}

type Props = {
  icon: IconComponent
  size?: Size
  className?: string
  iconClassName?: string
}

/** Neutral white icon container — use instead of colored gradient/accent icon backgrounds. */
export function IconTile({ icon: Icon, size = 'md', className, iconClassName }: Props) {
  return (
    <span
      className={cn('icon-tile flex shrink-0 items-center justify-center', TILE_SIZE[size], className)}
      aria-hidden
    >
      <Icon
        className={cn(ICON_SIZE[size], 'text-[var(--text-secondary)]', iconClassName)}
        strokeWidth={1.75}
        aria-hidden
      />
    </span>
  )
}

export const iconTileClassName = 'icon-tile flex shrink-0 items-center justify-center'
