'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CHANNEL_LABELS } from '@/lib/outreach/workflow-templates'
import type { OutreachCampaignWorkflowStep } from '@/lib/outreach/types'
import { cn } from '@/lib/utils'
import { Link2, Mail, MessageSquare, Plus, Trash2 } from 'lucide-react'

const CHANNEL_ICONS = {
  email: Mail,
  linkedin: Link2,
  sms: MessageSquare,
} as const

type Props = {
  steps: OutreachCampaignWorkflowStep[]
  onChange: (steps: OutreachCampaignWorkflowStep[]) => void
  disabled?: boolean
  /** When set, only LinkedIn steps can be added (separate from email campaigns). */
  linkedinOnly?: boolean
}

function emptyStep(index: number, linkedinOnly?: boolean): OutreachCampaignWorkflowStep {
  return {
    stepIndex: index,
    delayDays: index === 0 ? 0 : 2,
    channel: linkedinOnly ? 'linkedin' : 'email',
    intent: linkedinOnly
      ? 'Write a short LinkedIn connection note — under 300 characters, no pitch.'
      : 'Write a concise outreach message.',
    subject: '',
    body: '',
  }
}

export function CampaignSequenceBuilder({ steps, onChange, disabled, linkedinOnly }: Props) {
  function updateStep(index: number, patch: Partial<OutreachCampaignWorkflowStep>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch, stepIndex: i } : step)))
  }

  function addStep() {
    onChange([...steps, emptyStep(steps.length, linkedinOnly)])
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return
    onChange(steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, stepIndex: i })))
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = CHANNEL_ICONS[step.channel]
        return (
          <div
            key={`${step.stepIndex}-${index}`}
            className="rounded-xl border border-stone-200 bg-stone-50/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-stone-200',
                  )}
                >
                  <Icon className="h-4 w-4 text-stone-600" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">Step {index + 1}</p>
                  <p className="text-xs text-stone-500">{CHANNEL_LABELS[step.channel]}</p>
                </div>
              </div>
              {steps.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeStep(index)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {linkedinOnly ? (
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <p className="rounded-md border border-dashed border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
                    LinkedIn only — send on LinkedIn yourself
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={step.channel}
                    disabled={disabled}
                    onValueChange={(value) =>
                      updateStep(index, {
                        channel: value as OutreachCampaignWorkflowStep['channel'],
                        subject: value === 'email' ? step.subject : '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Delay (days)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={disabled}
                  value={step.delayDays}
                  onChange={(event) =>
                    updateStep(index, { delayDays: Number(event.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label className="text-stone-400">Send timing</Label>
                <p className="rounded-md border border-dashed border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
                  {step.delayDays === 0 ? 'Sends immediately on launch' : `Day ${step.delayDays} after launch`}
                </p>
              </div>
            </div>

            {step.channel === 'email' ? (
              <div className="mt-3 space-y-2">
                <Label>Subject</Label>
                <Input
                  disabled={disabled}
                  value={step.subject ?? ''}
                  onChange={(event) => updateStep(index, { subject: event.target.value })}
                  placeholder="Quick idea for {{company}}"
                />
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              <Label>Message</Label>
              <Textarea
                disabled={disabled}
                value={step.body}
                onChange={(event) => updateStep(index, { body: event.target.value })}
                rows={step.channel === 'linkedin' ? 4 : 6}
                placeholder={
                  step.channel === 'linkedin'
                    ? 'Hi {{first_name}} — would love to connect.'
                    : 'Hi {{first_name}}, ...'
                }
              />
              {step.channel === 'linkedin' ? (
                <p
                  className={cn(
                    'text-xs',
                    step.body.length > 300 ? 'font-medium text-red-600' : 'text-stone-500',
                  )}
                >
                  {step.body.length}/300 characters · send on LinkedIn from Results after launch
                </p>
              ) : null}
            </div>
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addStep}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add step
      </Button>
    </div>
  )
}
