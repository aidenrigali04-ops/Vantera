'use client'

import { recordOnboardingSuccessAction } from '@/app/(admin)/admin/dashboard/actions'
import { createContact } from '@/app/(admin)/admin/contacts/actions'
import type { CreateContactInput } from '@/app/(admin)/admin/contacts/actions'
import type { AdminSession } from '@/lib/auth/types'
import { CONTACT_TYPE_LABELS } from '@/lib/contacts/format'
import { persistOnboardingSuccessNotice } from '@/lib/import/fields'
import { DURATION, EASE_OUT } from '@/lib/motion'
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
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  session: AdminSession
}

function parseClientName(name: string): { firstName: string; lastName: string; source: string } {
  const trimmed = name.trim()
  if (!trimmed) return { firstName: 'New', lastName: 'Client', source: '' }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0] ?? 'New', lastName: 'Team', source: trimmed }
  }
  return {
    firstName: parts[0] ?? 'New',
    lastName: parts.slice(1).join(' ') || 'Contact',
    source: trimmed,
  }
}

type BusinessType = CreateContactInput['type']

export function NewClientDrawer({ session }: Props) {
  const router = useRouter()
  const { newClientDrawerOpen, setNewClientDrawerOpen } = useOnboardingStore()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<{
    clientName: string
    businessType: BusinessType
    email: string
  }>({
    clientName: '',
    businessType: 'agency_client',
    email: '',
  })

  function handleClose(open: boolean) {
    if (isPending) return
    setNewClientDrawerOpen(open)
  }

  function handleSubmit() {
    if (!form.clientName.trim()) {
      toast.error('Client name is required')
      return
    }

    const parsed = parseClientName(form.clientName)

    startTransition(async () => {
      const result = await createContact({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: form.email || undefined,
        type: form.businessType,
        source: parsed.source || form.clientName.trim(),
      })

      if (!result.success) {
        toast.error(result.error ?? 'Could not create client')
        return
      }

      const complete = await recordOnboardingSuccessAction()
      if (!complete.success) {
        toast.error(complete.error ?? 'Client saved, but setup could not be finalized')
      }

      persistOnboardingSuccessNotice(session.accountId, {
        kind: 'client',
        label: form.clientName.trim(),
      })

      toast.success('Client added')
      setNewClientDrawerOpen(false)
      setForm({ clientName: '', businessType: 'agency_client', email: '' })
      router.refresh()
    })
  }

  return (
    <Sheet open={newClientDrawerOpen} onOpenChange={handleClose}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New client</SheetTitle>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DURATION.modal, ease: EASE_OUT }}
          className="mt-6 flex-1 space-y-4"
        >
          <div>
            <Label htmlFor="client-name">Client name</Label>
            <Input
              id="client-name"
              placeholder="Acme Corporation"
              value={form.clientName}
              onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="business-type">Business type</Label>
            <Select
              value={form.businessType}
              onValueChange={(value) =>
                setForm((f) => ({
                  ...f,
                  businessType: value as BusinessType,
                }))
              }
            >
              <SelectTrigger id="business-type" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="contact-email">Contact email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="assigned-owner">Assigned owner</Label>
            <Input
              id="assigned-owner"
              value={session.email}
              readOnly
              className="mt-1.5 bg-stone-50 text-stone-600"
            />
          </div>
        </motion.div>

        <SheetFooter className="mt-6 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save client'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
