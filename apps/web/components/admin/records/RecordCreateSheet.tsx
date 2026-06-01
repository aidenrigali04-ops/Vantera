'use client'

import { createRecord } from '@/app/(admin)/admin/records/actions'
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { persistOnboardingSuccessNotice } from '@/lib/import/fields'
import type { stageDefinitions } from '@vantera/db'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordType: string
  stages: (typeof stageDefinitions.$inferSelect)[]
  accountId: string
  recordLabel: string
  contactId?: string
  scheduledAt?: string
}

export function RecordCreateSheet({
  open,
  onOpenChange,
  recordType,
  stages,
  accountId,
  recordLabel,
  contactId,
  scheduledAt,
}: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [contacts, setContacts] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState({
    title: '',
    contactId: contactId ?? '',
    stageId: stages[0]?.id ?? '',
    priority: 'normal' as const,
    value: '',
    source: '',
  })

  useEffect(() => {
    if (!open) return
    fetch('/api/contacts?limit=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setContacts(
            json.data.map((c: { id: string; firstName: string; lastName: string }) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
            })),
          )
        }
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (stages[0]?.id) {
      setForm((f) => ({ ...f, stageId: stages[0]!.id }))
    }
  }, [stages])

  const handleSubmit = async () => {
    if (!form.title || !form.contactId || !form.stageId) {
      toast.error('Title, contact, and stage are required')
      return
    }

    setSaving(true)
    const valueCents = Math.round(Number(form.value || 0) * 100)
    const result = await createRecord({
      title: form.title,
      contactId: form.contactId,
      stageId: form.stageId,
      recordType,
      priority: form.priority,
      valueCents,
      source: form.source || undefined,
      scheduledAt: scheduledAt ?? undefined,
    })
    setSaving(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`${recordLabel} created`)
    if (recordType === 'deal' || recordType === 'project') {
      persistOnboardingSuccessNotice(accountId, {
        kind: recordType,
        label: form.title.trim(),
      })
    }
    onOpenChange(false)
    await queryClient.invalidateQueries({ queryKey: ['records'] })
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create {recordLabel}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Contact</Label>
            <Select
              value={form.contactId}
              onValueChange={(v) => setForm((f) => ({ ...f, contactId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Stage</Label>
            <Select
              value={form.stageId}
              onValueChange={(v) => setForm((f) => ({ ...f, stageId: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Value ($)</Label>
            <Input
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, priority: v as typeof form.priority }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['urgent', 'high', 'normal', 'low'].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : `Create ${recordLabel}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
