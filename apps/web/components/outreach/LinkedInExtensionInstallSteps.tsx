'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import Link from 'next/link'

const EXTENSION_ZIP_PATH = '/vantera-linkedin-extension.zip'

export function LinkedInExtensionInstallSteps() {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4 space-y-3">
      <p className="text-[13px] font-medium text-[var(--text-primary)]">
        Not in the Chrome Web Store yet
      </p>
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
        Install once from the file below (takes about two minutes). After that, Vantera connects with
        your connection code — same as email tools that use a browser helper.
      </p>
      <Button type="button" variant="outline" size="sm" asChild>
        <a href={EXTENSION_ZIP_PATH} download="vantera-linkedin-extension.zip">
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Download Vantera LinkedIn add-on (zip)
        </a>
      </Button>
      <ol className="list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
        <li>
          Unzip the file — you should see a folder with{' '}
          <span className="font-mono text-[11px] text-[var(--text-primary)]">manifest.json</span>{' '}
          inside.
        </li>
        <li>
          In Chrome, open{' '}
          <Link
            href="chrome://extensions"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Extensions
          </Link>{' '}
          (or menu → Extensions → Manage Extensions).
        </li>
        <li>
          Turn on <strong>Developer mode</strong> (top-right on the Extensions page).
        </li>
        <li>
          Click <strong>Load unpacked</strong> and select the unzipped folder (not the zip file).
        </li>
        <li>
          Pin <strong>Vantera LinkedIn Outreach</strong> from the puzzle icon in the toolbar so you can
          open it easily.
        </li>
      </ol>
    </div>
  )
}
