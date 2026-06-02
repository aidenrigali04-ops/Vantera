import { AuthLogo } from '@/components/auth/auth-logo'
import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalDocumentShellProps = {
  title: string
  updatedAt: string
  children: ReactNode
}

/** Calm, readable legal page — matches auth stone palette without the split layout. */
export function LegalDocumentShell({ title, updatedAt, children }: LegalDocumentShellProps) {
  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="border-b border-stone-200/80 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <AuthLogo />
          <Link
            href="/"
            className="text-[13px] font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="space-y-2 border-b border-stone-200 pb-8">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-stone-900">{title}</h1>
          <p className="text-[13px] text-stone-500">Last updated {updatedAt}</p>
        </div>

        <article className="prose-legal space-y-8 pt-8 text-[15px] leading-relaxed text-stone-700">
          {children}
        </article>
      </main>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-stone-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
