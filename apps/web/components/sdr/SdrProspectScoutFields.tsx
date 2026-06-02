'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ProspectMode } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import { Bookmark, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  PROSPECT_MODE_OPTIONS,
  type BindingDraft,
  type SavedSearchOption,
} from '@/components/sdr/sdr-aspire-ui'

type Props = {
  prospectMode: ProspectMode
  onProspectModeChange: (mode: ProspectMode) => void
  defaultMinIcpScore: number
  onDefaultMinIcpScoreChange: (value: number) => void
  syncIcpToSavedSearches: boolean
  onSyncIcpChange: (value: boolean) => void
  bindings: BindingDraft[]
  onBindingsChange: (bindings: BindingDraft[]) => void
  savedSearches: SavedSearchOption[]
  compact?: boolean
  wizard?: boolean
}

export function SdrProspectScoutFields({
  prospectMode,
  onProspectModeChange,
  defaultMinIcpScore,
  onDefaultMinIcpScoreChange,
  syncIcpToSavedSearches,
  onSyncIcpChange,
  bindings,
  onBindingsChange,
  savedSearches,
  compact = false,
  wizard = false,
}: Props) {
  const showBindings = prospectMode === 'aspire_bound' || prospectMode === 'hybrid'
  const boundIds = new Set(bindings.map((b) => b.savedSearchId))
  const availableToAdd = savedSearches.filter((s) => !boundIds.has(s.id))

  function addBinding(searchId: string) {
    const search = savedSearches.find((s) => s.id === searchId)
    if (!search) return
    onBindingsChange([
      ...bindings,
      {
        savedSearchId: search.id,
        searchName: search.name,
        priority: bindings.length,
        minIcpScore: defaultMinIcpScore,
        maxLeadsPerRun: 25,
        autoEnrollSdr: true,
        isActive: true,
      },
    ])
  }

  function updateBinding(id: string, patch: Partial<BindingDraft>) {
    onBindingsChange(
      bindings.map((b) => (b.savedSearchId === id ? { ...b, ...patch } : b)),
    )
  }

  function removeBinding(id: string) {
    onBindingsChange(
      bindings
        .filter((b) => b.savedSearchId !== id)
        .map((b, index) => ({ ...b, priority: index })),
    )
  }

  return (
    <div className={cn('space-y-8', wizard && 'space-y-4')}>
      <section className={cn('space-y-3', wizard && 'space-y-2')}>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            Discovery source
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            How Prospect Scout finds leads for your pipeline.
          </p>
        </div>
        <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
          {PROSPECT_MODE_OPTIONS.map((option) => {
            const selected = prospectMode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onProspectModeChange(option.value)}
                className={cn(
                  'card-surface card-surface-interactive rounded-[var(--radius-lg)] p-4 text-left transition-[border-color,box-shadow] duration-150',
                  selected
                    ? 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)] shadow-[var(--shadow-glow)]'
                    : 'border-[var(--border-default)]',
                )}
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{option.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {option.description}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      <section className={cn('card-surface space-y-4 p-4 sm:p-5', wizard && 'p-3 sm:p-4')}>
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
          Scoring defaults
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="default-min-icp" className="text-[var(--text-secondary)]">
              Default minimum ICP score
            </Label>
            <Input
              id="default-min-icp"
              type="number"
              min={0}
              max={100}
              className="mt-2 border-[var(--border-default)] bg-[var(--bg-surface)] focus-visible:ring-[var(--accent)]"
              value={defaultMinIcpScore}
              onChange={(e) =>
                onDefaultMinIcpScoreChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
              }
            />
          </div>
          <div className="flex items-end gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 p-4">
            <Switch
              id="sync-icp"
              checked={syncIcpToSavedSearches}
              onCheckedChange={onSyncIcpChange}
              className="data-[state=checked]:bg-[var(--accent)]"
            />
            <div>
              <Label htmlFor="sync-icp" className="text-[var(--text-primary)]">
                Sync ICP to bound searches
              </Label>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                Push agent ICP into each bound saved search on save.
              </p>
            </div>
          </div>
        </div>
      </section>

      {showBindings ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                Saved search bindings
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Higher priority runs first. Each binding can override score and enrollment caps.
              </p>
            </div>
            {availableToAdd.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  className="h-9 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addBinding(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  aria-label="Add saved search binding"
                >
                  <option value="" disabled>
                    Add saved search…
                  </option>
                  {availableToAdd.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[var(--border-default)]"
                  onClick={() => availableToAdd[0] && addBinding(availableToAdd[0].id)}
                  disabled={!availableToAdd[0]}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          {savedSearches.length === 0 ? (
            <div className="card-surface flex flex-col items-center gap-3 px-6 py-10 text-center">
              <Bookmark className="h-8 w-8 text-[var(--text-tertiary)]" aria-hidden />
              <p className="text-sm text-[var(--text-secondary)]">
                Optional: create saved searches in Lead finder, then bind them here for
                hybrid mode. Autonomous scout does not require this.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[var(--border-default)]"
              >
                <Link href="/admin/outreach/aspire">Lead finder (optional)</Link>
              </Button>
            </div>
          ) : bindings.length === 0 ? (
            <div className="card-surface border-dashed px-6 py-8 text-center text-sm text-[var(--text-secondary)]">
              Select at least one saved search to run bound prospecting.
            </div>
          ) : (
            <ul className="space-y-3">
              {bindings.map((binding, index) => (
                <li
                  key={binding.savedSearchId}
                  className="card-surface overflow-hidden rounded-[var(--radius-lg)]"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {binding.searchName}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">Priority {index + 1}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Checkbox
                          checked={binding.isActive}
                          onCheckedChange={(checked) =>
                            updateBinding(binding.savedSearchId, { isActive: checked === true })
                          }
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="icon-btn text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                        onClick={() => removeBinding(binding.savedSearchId)}
                        aria-label={`Remove ${binding.searchName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {!compact ? (
                    <div className="grid gap-4 p-4 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs text-[var(--text-tertiary)]">Min ICP score</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="mt-1 h-9 border-[var(--border-default)]"
                          value={binding.minIcpScore}
                          onChange={(e) =>
                            updateBinding(binding.savedSearchId, {
                              minIcpScore: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-[var(--text-tertiary)]">Max leads / run</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="mt-1 h-9 border-[var(--border-default)]"
                          value={binding.maxLeadsPerRun}
                          onChange={(e) =>
                            updateBinding(binding.savedSearchId, {
                              maxLeadsPerRun: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <Switch
                          checked={binding.autoEnrollSdr}
                          onCheckedChange={(checked) =>
                            updateBinding(binding.savedSearchId, { autoEnrollSdr: checked })
                          }
                          className="data-[state=checked]:bg-[var(--accent)]"
                        />
                        <Label className="text-xs text-[var(--text-secondary)]">
                          Add to pipeline automatically
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4 px-4 py-3 text-xs text-[var(--text-secondary)]">
                      <span>ICP ≥ {binding.minIcpScore}</span>
                      <span>Up to {binding.maxLeadsPerRun} leads/run</span>
                      <span>{binding.autoEnrollSdr ? 'Auto-add' : 'Score only'}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
