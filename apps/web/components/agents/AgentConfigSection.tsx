'use client'

import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export function AgentConfigSection({ title, description, children }: Props) {
  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
