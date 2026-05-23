'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import { useState } from 'react'
import { inviteTeamMembers } from '../actions'

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

    const result = await inviteTeamMembers(accountId, toSend)

    setSending(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete({ invited: result.data.invited, skipped: false })
  }

  function handleSkip() {
    onComplete({ invited: 0, skipped: true })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Invite your team</h2>
        <p className="text-sm text-muted-foreground">
          Add up to {MAX_MEMBERS} teammates. They'll receive an email invite with a magic sign-in link.
        </p>
      </div>

      <div className="space-y-3">
        {members.map((member, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="teammate@email.com"
              value={member.email}
              onChange={(e) => updateMember(index, { email: e.target.value })}
              className="flex-1"
            />
            <Select
              value={member.role}
              onValueChange={(value) => updateMember(index, { role: value as Role })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove member"
                onClick={() => removeMember(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}

        {members.length < MAX_MEMBERS ? (
          <button
            type="button"
            onClick={addMember}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            + Add another member
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Team plan supports up to {MAX_MEMBERS} invited members.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Skip for now
        </button>
        <Button type="button" onClick={handleSend} disabled={sending} style={{ backgroundColor: primaryColor }}>
          {sending ? 'Sending invites…' : 'Send invites'}
        </Button>
      </div>
    </div>
  )
}
