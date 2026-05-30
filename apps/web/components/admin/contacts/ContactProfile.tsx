'use client'

import { updateContact } from '@/app/(admin)/admin/contacts/actions'
import {
  CONTACT_TYPE_COLORS,
  CONTACT_TYPE_LABELS,
  avatarColorClass,
  contactInitials,
  formatRelativeTime,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { activities, contacts, records } from '@vantera/db'
import { Brain, GitMerge, Mail, Phone, Zap } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

type Contact = typeof contacts.$inferSelect
type Activity = typeof activities.$inferSelect
type RecordRow = typeof records.$inferSelect

type Props = {
  contact: Contact
  activities: Activity[]
  relatedRecords: RecordRow[]
  openRecordsCount: number
}

export function ContactProfile({ contact, activities, relatedRecords, openRecordsCount }: Props) {
  const labels = useVerticalLabels()
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
  })

  const name = `${contact.firstName} ${contact.lastName}`

  const handleSave = async () => {
    setSaving(true)
    const result = await updateContact(contact.id, form)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Contact updated')
    setEditOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${avatarColorClass(name)}`}
            >
              {contactInitials(contact.firstName, contact.lastName)}
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">{name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className={CONTACT_TYPE_COLORS[contact.type]}>
                  {CONTACT_TYPE_LABELS[contact.type]}
                </Badge>
                {(contact.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <InfoField label="Email" value={contact.email} />
          <InfoField label="Phone" value={contact.phone} />
          <InfoField
            label="Address"
            value={[contact.addressLine1, contact.city, contact.state, contact.zip]
              .filter(Boolean)
              .join(', ')}
          />
          <InfoField label="Source" value={contact.source} />
          <InfoField label="Created" value={new Date(contact.createdAt).toLocaleDateString()} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {contact.phone ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${contact.phone}`}>
                <Phone className="mr-2 h-4 w-4" /> Call
              </a>
            </Button>
          ) : null}
          {contact.phone ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`sms:${contact.phone}`}>
                <Phone className="mr-2 h-4 w-4" /> Text
              </a>
            </Button>
          ) : null}
          {contact.email ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${contact.email}`}>
                <Mail className="mr-2 h-4 w-4" /> Email
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="stages">Stage Changes</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4 space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-stone-500">No activity yet.</p>
            ) : (
              activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {labels.records} ({openRecordsCount})
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/crm/clients?contactId=${contact.id}`}>Add {labels.record}</Link>
          </Button>
        </div>
        <div className="space-y-3">
          {relatedRecords.length === 0 ? (
            <p className="text-sm text-stone-500">No {labels.records.toLowerCase()} linked yet.</p>
          ) : (
            relatedRecords.map((record) => (
              <Link
                key={record.id}
                href={`/admin/records/${record.id}`}
                className="block rounded-lg border border-stone-200 p-4 transition-all hover:border-stone-300 hover:shadow-sm"
              >
                <p className="font-medium text-stone-900">{record.title}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {formatUsdFromCents(record.valueCents)}
                  {record.scheduledAt
                    ? ` · ${new Date(record.scheduledAt).toLocaleDateString()}`
                    : ''}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit contact</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} disabled={saving}>
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-sm text-stone-900">{value || '—'}</p>
    </div>
  )
}

function ActivityRow({ activity }: { activity: Activity }) {
  const Icon =
    activity.actorType === 'automation'
      ? GitMerge
      : activity.actorType === 'system'
        ? Zap
        : activity.activityType.includes('agent')
          ? Brain
          : Zap

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100">
        <Icon className="h-4 w-4 text-stone-600" />
      </span>
      <div>
        <p className="text-sm text-stone-800">{activity.body ?? activity.activityType}</p>
        <p className="text-xs text-stone-500">{formatRelativeTime(activity.createdAt)}</p>
      </div>
    </div>
  )
}
