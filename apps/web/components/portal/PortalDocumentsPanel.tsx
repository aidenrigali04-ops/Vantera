import type { PortalDocument } from '@/lib/portal/types'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { ExternalLink, FileText } from 'lucide-react'

type PortalDocumentsPanelProps = {
  documents: PortalDocument[]
}

export function PortalDocumentsPanel({ documents }: PortalDocumentsPanelProps) {
  if (documents.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-secondary)]">
        Shared documents from your team will appear here.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{doc.title}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                {doc.docType.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {doc.requiresSignature && !doc.signedAt ? (
              <StatusBadge label="Signature needed" tone="warning" />
            ) : null}
            <Button size="sm" variant="outline" className="h-8" asChild>
              <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer">
                Open
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
