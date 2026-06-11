'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import {
  applyVerticalTemplate,
  getTemplatesForVertical,
  type TemplateSummary,
} from '../actions'
import { StepError, fadeUp, rethrowFrameworkNavigation, runStepAction, stepContainer } from '../_primitives'

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
      try {
        const result = await runStepAction(() => getTemplatesForVertical(vertical))
        if (cancelled) return

        if (!result || result.success !== true) {
          setError(
            (result && 'error' in result && result.error) ||
              'Could not load workflow templates.',
          )
          return
        }

        setTemplates(result.data)
        if (result.data.length === 1 && result.data[0]) {
          setSelectedId(result.data[0].id)
        }
      } catch (err) {
        if (cancelled) return
        rethrowFrameworkNavigation(err)
        console.error('[Step3Template] getTemplatesForVertical threw', err)
        setError(err instanceof Error ? err.message : 'Failed to load templates.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [vertical])

  const selected = templates.find((t) => t.id === selectedId)

  const submit = useCallback(async (): Promise<boolean> => {
    if (templates.length > 0 && !selectedId) {
      setError('Select a workflow template to continue.')
      return false
    }

    if (!selectedId) {
      onComplete()
      return true
    }

    setError(null)
    setApplying(true)

    try {
      const result = await runStepAction(() => applyVerticalTemplate(accountId, selectedId))

      if (!result || result.success !== true) {
        setError(
          (result && 'error' in result && result.error) ||
            'Could not apply this template. Please try again.',
        )
        return false
      }

      onComplete(result.data)
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step3Template] applyVerticalTemplate threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setApplying(false)
    }
  }, [accountId, onComplete, selectedId, templates.length])

  useRegisterOnboardingStep({
    canAdvance: !loading && (templates.length === 0 || Boolean(selectedId)),
    isSubmitting: applying,
    primaryLabel: applying
      ? 'Applying…'
      : templates.length === 0
        ? 'Continue'
        : 'Apply and continue',
    submit,
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      {loading ? (
        <motion.div
          variants={fadeUp}
          className="h-28 animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]"
        />
      ) : templates.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-[13px] leading-relaxed text-[var(--text-secondary)]"
        >
          No templates are available for this business type yet. Contact support if you need help
          setting up your pipeline after onboarding.
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {templates.map((template) => {
            const isSelected = selectedId === template.id
            const stageCount = Array.isArray(template.templateData.stages)
              ? template.templateData.stages.length
              : 0
            const automationCount = Array.isArray(template.templateData.automations)
              ? template.templateData.automations.length
              : 0

            return (
              <motion.button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.995 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                style={
                  isSelected
                    ? {
                        borderColor: `${primaryColor}66`,
                        boxShadow: `0 0 0 1px ${primaryColor}40, 0 12px 28px -16px ${primaryColor}aa`,
                      }
                    : undefined
                }
                className={cn(
                  'group relative block w-full overflow-hidden rounded-2xl border bg-[var(--bg-surface)] p-5 text-left transition-colors',
                  isSelected
                    ? 'bg-[var(--bg-overlay)]'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-overlay)]',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute -right-12 -top-12 size-32 rounded-full blur-2xl transition-opacity duration-500',
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
                  )}
                  style={{
                    background: `radial-gradient(circle at center, ${primaryColor}66, transparent 70%)`,
                  }}
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{templateLabel(template)}</p>
                    {template.templateData.description ? (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
                        {template.templateData.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[10px]">
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 py-0.5 font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                      {stageCount} stages
                    </span>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 py-0.5 font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                      {automationCount} automations
                    </span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      )}

      {selected &&
      Array.isArray(selected.templateData.stages) &&
      selected.templateData.stages.length > 0 ? (
        <motion.div variants={fadeUp} className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Pipeline preview
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
            <div className="flex gap-1.5">
              {selected.templateData.stages.map((stage, index) => {
                const color = stage.color ?? '#64748B'
                return (
                  <motion.span
                    key={`${stage.label}-${index}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * index, ease: 'easeOut' }}
                    style={{
                      borderColor: `${color}55`,
                      color,
                      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
                      boxShadow: `0 0 12px -6px ${color}66`,
                    }}
                    className="whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium"
                  >
                    {stage.label}
                  </motion.span>
                )
              })}
            </div>
          </div>
        </motion.div>
      ) : null}

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}

function templateLabel(template: TemplateSummary): string {
  const recordTypeLabel = template.recordType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return `${recordTypeLabel} Workflow`
}
