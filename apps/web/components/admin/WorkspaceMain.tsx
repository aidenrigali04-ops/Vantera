import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type WorkspaceMainProps = {
  children: ReactNode
  className?: string
  /** When false, content spans full width (e.g. wide tables). */
  constrained?: boolean
}

/**
 * Step 1 — consistent main workspace surface inside AdminShell.
 * Light, calm enterprise canvas; individual pages opt into full-bleed when needed.
 */
export function WorkspaceMain({ children, className, constrained = true }: WorkspaceMainProps) {
  return (
    <main
      className={cn(
        'min-h-0 flex-1 bg-[var(--bg-base)]',
        constrained ? 'overflow-y-auto pb-20 md:pb-6' : 'overflow-hidden',
        className,
      )}
    >
      <div
        className={cn(
          constrained && 'mx-auto w-full max-w-[1280px] px-4 py-5 md:px-8 md:py-6',
          !constrained && 'flex min-h-full w-full flex-col',
        )}
      >
        {children}
      </div>
    </main>
  )
}
