'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { motion } from 'framer-motion'
import { Mail, Plus, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { inviteTeamSeat } from '@/lib/team/actions'
import {
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

const INVITE_ROLES = ['admin', 'manager', 'staff', 'technician', 'agent'] as const
type InviteRole = (typeof INVITE_ROLES)[number]

const ROLE_LABELS: Record<InviteRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  technician: 'Technician',
  agent: 'Agent',
}

const MAX_MEMBERS = 10

type Member = { email: string; role: InviteRole }

type Props = {
  onComplete: (data?: { invited: number; skipped: boolean }) => void
}

export function Step4Team({ onComplete }: Props) {
  const [members, setMembers] = useState<Member[]>([{ email: '', role: 'manager' }])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateMember(index: number, patch: Partial<Member>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  function addMember() {
    if (members.length >= MAX_MEMBERS) {
      return
    }
    setMembers((prev) => [...prev, { email: '', role: 'staff' }])
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = useCallback(async (): Promise<boolean> => {
    const toSend = members
      .map((m) => ({ email: m.email.trim(), role: m.role }))
      .filter((m) => m.email.length > 0)

    if (toSend.length === 0) {
      onComplete({ invited: 0, skipped: true })
      return true
    }

    setError(null)
    setSending(true)

    try {
      let invited = 0
      for (const member of toSend) {
        const result = await runStepAction(() => inviteTeamSeat(member))
        if (!result || result.success !== true) {
          setError(
            (result && 'error' in result && result.error) ||
              'Could not send some invites. You can invite teammates later from Settings.',
          )
          // Report partial success if at least one invite went through
          if (invited > 0) onComplete({ invited, skipped: false })
          return false
        }
        invited++
      }

      onComplete({ invited, skipped: false })
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step4Team] inviteTeamSeat threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSending(false)
    }
  }, [members, onComplete])

  const skip = useCallback(() => {
    onComplete({ invited: 0, skipped: true })
  }, [onComplete])

  useRegisterOnboardingStep({
    canAdvance: true,
    isSubmitting: sending,
    primaryLabel: sending ? 'Sending…' : 'Send invites',
    submit,
    secondary: { label: 'Skip for now', action: skip },
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp} className="space-y-2">
        {members.map((member, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * index, ease: 'easeOut' }}
            className="group flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 transition-colors duration-[120ms] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-tertiary)] ring-1 ring-inset ring-[var(--border-subtle)]"
            >
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <Input
              type="email"
              placeholder="teammate@email.com"
              value={member.email}
              onChange={(e) => updateMember(index, { email: e.target.value })}
              className="h-9 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-white/30 shadow-none focus-visible:ring-0"
            />
            <Select
              value={member.role}
              onValueChange={(value) => updateMember(index, { role: value as InviteRole })}
            >
              <SelectTrigger className="h-9 w-[140px] border border-white/[0.06] bg-white/[0.03] text-xs text-white shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[#0F141B] text-white">
                {INVITE_ROLES.map((role) => (
                  <SelectItem
                    key={role}
                    value={role}
                    className="text-xs text-white focus:bg-white/[0.06] focus:text-white"
                  >
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length > 1 ? (
              <button
                type="button"
                onClick={() => removeMember(index)}
                aria-label="Remove member"
                className="flex h-9 w-9 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </motion.div>
        ))}

        {members.length < MAX_MEMBERS ? (
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={addMember}
            whileHover={{ x: 2 }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add another member
          </motion.button>
        ) : (
          <p className="text-xs text-white/45">
            Up to {MAX_MEMBERS} invites at once — add more from Settings anytime.
          </p>
        )}
      </motion.div>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
