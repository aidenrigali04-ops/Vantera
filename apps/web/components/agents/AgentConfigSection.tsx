'use client'

import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export function AgentConfigSection({ title, description, children }: Props) {
  return (
    <section className="border-b border-[var(--border-subtle)] py-8 first:pt-0 last:border-0">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
