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
import { useState } from 'react'
import { inviteTeamMembers } from '../actions'
import {
  GhostCTA,
  PrimaryCTA,
  StepError,
  StepHeader,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

const ROLES = ['owner', 'admin', 'manager', 'staff', 'technician', 'agent'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  technician: 'Technician',
  agent: 'Agent',
}

const MAX_MEMBERS = 3

type Member = { email: string; role: Role }

type Props = {
  accountId: string
  primaryColor: string
  onComplete: (data?: { invited: number; skipped: boolean }) => void
}

export function Step4Team({ accountId, primaryColor, onComplete }: Props) {
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

  async function handleSend() {
    const toSend = members
      .map((m) => ({ email: m.email.trim(), role: m.role }))
      .filter((m) => m.email.length > 0)

    if (toSend.length === 0) {
      onComplete({ invited: 0, skipped: true })
      return
    }

    setError(null)
    setSending(true)

    try {
      const result = await runStepAction(() => inviteTeamMembers(accountId, toSend))

      if (!result || result.success !== true) {
        setError(
          (result && 'error' in result && result.error) ||
            'Could not send invites. You can invite teammates later from settings.',
        )
        return
      }

      onComplete({ invited: result.data.invited, skipped: false })
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step4Team] inviteTeamMembers threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleSkip() {
    onComplete({ invited: 0, skipped: true })
  }

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-8">
      <StepHeader
        title="Invite your team"
        subtitle={`Add up to ${MAX_MEMBERS} teammates. They'll receive an email with a magic sign-in link — no passwords needed.`}
      />

      <motion.div variants={fadeUp} className="space-y-3">
        {members.map((member, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * index, ease: 'easeOut' }}
            className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035]"
          >
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/55 ring-1 ring-inset ring-white/[0.06]"
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
              onValueChange={(value) => updateMember(index, { role: value as Role })}
            >
              <SelectTrigger className="h-9 w-[140px] border border-white/[0.06] bg-white/[0.03] text-xs text-white shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-[#0F141B] text-white">
                {ROLES.map((role) => (
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
            Team plan supports up to {MAX_MEMBERS} invited members.
          </p>
        )}
      </motion.div>

      {error ? <StepError message={error} /> : null}

      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <GhostCTA type="button" onClick={handleSkip}>
          Skip for now
        </GhostCTA>
        <PrimaryCTA
          type="button"
          onClick={handleSend}
          disabled={sending}
          loading={sending}
          primaryColor={primaryColor}
          className="min-w-[180px]"
        >
          {sending ? 'Sending invites…' : 'Send invites'}
        </PrimaryCTA>
      </motion.div>
    </motion.div>
  )
}
