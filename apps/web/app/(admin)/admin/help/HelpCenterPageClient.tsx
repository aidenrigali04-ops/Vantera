'use client'

import { LinkedInOutreachHelpArticle } from '@/components/help/LinkedInOutreachHelpArticle'
import { PageHeader } from '@/components/operational/PageHeader'
import {
  HELP_ARTICLES,
  normalizeHelpArticleId,
  type HelpArticleId,
} from '@/lib/help/articles'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

type Props = {
  appOrigin: string
}

export function HelpCenterPageClient({ appOrigin }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const articleId = normalizeHelpArticleId(searchParams.get('article'))

  const setArticle = useCallback(
    (id: HelpArticleId) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id === 'overview') params.delete('article')
      else params.set('article', id)
      const query = params.toString()
      router.replace(query ? `/admin/help?${query}` : '/admin/help', { scroll: false })
    },
    [router, searchParams],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help Center"
        description="Step-by-step guides for outreach, LinkedIn, email, and workspace tools."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <nav
          className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
          aria-label="Help topics"
        >
          {HELP_ARTICLES.map((article) => {
            const Icon = article.icon
            const active = articleId === article.id
            const href = article.externalHref

            if (href) {
              return (
                <Link
                  key={article.id}
                  href={href}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {article.title}
                  <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" aria-hidden />
                </Link>
              )
            }

            return (
              <button
                key={article.id}
                type="button"
                onClick={() => setArticle(article.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                    : 'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {article.title}
              </button>
            )
          })}
        </nav>

        <div className="card-surface p-5 sm:p-6">
          {articleId === 'overview' ? (
            <HelpOverview onSelectArticle={setArticle} />
          ) : articleId === 'linkedin-outreach' ? (
            <>
              <header className="mb-6 border-b border-[var(--border-subtle)] pb-4">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Set up LinkedIn outreach
                </h2>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  Connect the add-on, prepare prospects, launch campaigns, and send connection notes on
                  LinkedIn.
                </p>
              </header>
              <LinkedInOutreachHelpArticle appOrigin={appOrigin} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HelpOverview({ onSelectArticle }: { onSelectArticle: (id: HelpArticleId) => void }) {
  const guides = HELP_ARTICLES.filter((a) => a.id !== 'overview')

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Guides
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Pick a topic for step-by-step instructions inside Vantera.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {guides.map((article) => {
          const Icon = article.icon
          const content = (
            <li
              key={article.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{article.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {article.description}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
              </div>
            </li>
          )

          if (article.externalHref) {
            return (
              <Link key={article.id} href={article.externalHref} className="block">
                {content}
              </Link>
            )
          }

          return (
            <button
              key={article.id}
              type="button"
              className="w-full text-left"
              onClick={() => onSelectArticle(article.id)}
            >
              {content}
            </button>
          )
        })}
      </ul>
    </div>
  )
}
