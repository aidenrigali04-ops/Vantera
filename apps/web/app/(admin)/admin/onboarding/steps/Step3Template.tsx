'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  applyVerticalTemplate,
  getTemplatesForVertical,
  type TemplateSummary,
} from '../actions'
import { PrimaryCTA, StepError, StepHeader, fadeUp, stepContainer } from '../_primitives'

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
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-8">
      <StepHeader
        title="Pick a starter workflow"
        subtitle="We'll load a vetted stage pipeline and automation set, personalized to your voice. You can adjust anything later from settings."
      />

      {loading ? (
        <motion.div
          variants={fadeUp}
          className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        />
      ) : templates.length === 0 ? (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-6 text-sm leading-relaxed text-white/55"
        >
          No templates available for this business type yet — you can skip this step and build your
          own pipeline later.
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
                  'group relative block w-full overflow-hidden rounded-2xl border bg-white/[0.02] p-5 text-left transition-colors',
                  isSelected
                    ? 'bg-white/[0.04]'
                    : 'border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035]',
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
                    <p className="text-sm font-semibold text-white">{templateLabel(template)}</p>
                    {template.templateData.description ? (
                      <p className="mt-1 text-xs leading-relaxed text-white/55">
                        {template.templateData.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[10px]">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-medium uppercase tracking-wider text-white/65">
                      {stageCount} stages
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-medium uppercase tracking-wider text-white/65">
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
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">
            Pipeline preview
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3">
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

      <motion.div variants={fadeUp} className="flex items-center justify-end">
        <PrimaryCTA
          type="button"
          onClick={handleContinue}
          disabled={applying}
          loading={applying}
          primaryColor={primaryColor}
          className="min-w-[200px]"
        >
          {applying ? 'Applying…' : selectedId ? 'Apply and continue' : 'Skip for now'}
        </PrimaryCTA>
      </motion.div>
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
