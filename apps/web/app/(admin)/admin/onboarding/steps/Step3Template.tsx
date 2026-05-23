'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
  applyVerticalTemplate,
  getTemplatesForVertical,
  type TemplateSummary,
} from '../actions'

type Props = {
  accountId: string
  vertical: string | null
  primaryColor: string
  onComplete: (data?: { stageCount: number; automationCount: number }) => void
}

export function Step3Template({ accountId, vertical, primaryColor, onComplete }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!vertical) {
        setLoading(false)
        return
      }

      setLoading(true)
      const result = await getTemplatesForVertical(vertical)

      if (cancelled) {
        return
      }

      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }

      setTemplates(result.data)
      if (result.data.length === 1 && result.data[0]) {
        setSelectedId(result.data[0].id)
      }
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [vertical])

  const selected = templates.find((t) => t.id === selectedId)

  async function handleContinue() {
    if (!selectedId) {
      onComplete()
      return
    }

    setError(null)
    setApplying(true)

    const result = await applyVerticalTemplate(accountId, selectedId)

    setApplying(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete(result.data)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Pick a starter workflow</h2>
        <p className="text-sm text-muted-foreground">
          We'll load a stage pipeline and automation set you can adjust later.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          No templates available for this business type yet — you can skip this step and build your own pipeline later.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const isSelected = selectedId === template.id
            const stageCount = Array.isArray(template.templateData.stages)
              ? template.templateData.stages.length
              : 0
            const automationCount = Array.isArray(template.templateData.automations)
              ? template.templateData.automations.length
              : 0

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                style={isSelected ? { borderColor: primaryColor, boxShadow: `0 0 0 1px ${primaryColor}` } : undefined}
                className={cn(
                  'block w-full rounded-lg border bg-card p-4 text-left transition-colors',
                  isSelected ? 'bg-accent/30' : 'hover:bg-accent/40',
                )}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium">{templateLabel(template)}</p>
                  <div className="flex shrink-0 gap-3 text-xs text-muted-foreground">
                    <span>{stageCount} stages</span>
                    <span>{automationCount} automations included</span>
                  </div>
                </div>
                {template.templateData.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{template.templateData.description}</p>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {selected && Array.isArray(selected.templateData.stages) && selected.templateData.stages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline preview</p>
          <div className="flex gap-2 overflow-x-auto rounded-md bg-muted/30 p-3">
            {selected.templateData.stages.map((stage, index) => (
              <span
                key={`${stage.label}-${index}`}
                style={{ borderColor: stage.color ?? '#64748B', color: stage.color ?? '#64748B' }}
                className="whitespace-nowrap rounded-full border bg-background px-3 py-1 text-xs font-medium"
              >
                {stage.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={applying}
          style={{ backgroundColor: primaryColor }}
        >
          {applying ? 'Applying…' : selectedId ? 'Apply and continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  )
}

function templateLabel(template: TemplateSummary): string {
  const recordTypeLabel = template.recordType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return `${recordTypeLabel} Workflow`
}
