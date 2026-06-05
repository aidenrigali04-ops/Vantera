'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

const STORE_URL = process.env.NEXT_PUBLIC_LINKEDIN_EXTENSION_STORE_URL?.trim() ?? ''

export function LinkedInExtensionInstallSteps() {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4 space-y-3">
      <p className="text-[13px] font-medium text-[var(--text-primary)]">Install from Chrome</p>
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Add the <strong>Vantera LinkedIn Outreach</strong> extension from the Chrome Web Store, then
        connect it below with your connection code.
      </p>
      {STORE_URL ? (
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
            Open in Chrome Web Store
          </a>
        </Button>
      ) : (
        <p className="text-[12px] text-[var(--text-secondary)]">
          In the{' '}
          <a
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Chrome Web Store
          </a>
          , search for <strong>Vantera LinkedIn Outreach</strong> and click <strong>Add to Chrome</strong>.
        </p>
      )}
      <ol className="list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        <li>Pin the extension from Chrome&apos;s puzzle icon in the toolbar.</li>
        <li>Stay logged into LinkedIn in the same Chrome profile.</li>
      </ol>
    </div>
  )
}
