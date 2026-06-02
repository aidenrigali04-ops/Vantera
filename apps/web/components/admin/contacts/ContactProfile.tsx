'use client'

import { PortalAccessPanel } from '@/components/admin/contacts/PortalAccessPanel'
import { updateContact } from '@/app/(admin)/admin/contacts/actions'
import { EmbeddedInsightsPanel } from '@/components/intelligence/EmbeddedInsightsPanel'
import {
  DetailBackLink,
  DetailField,
  DetailFieldGrid,
  DetailHeader,
  DetailLayout,
  DetailSection,
  DetailShell,
  DetailTimeline,
} from '@/components/operational/detail/DetailShell'
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
import {
  CONTACT_TYPE_COLORS,
  CONTACT_TYPE_LABELS,
  avatarColorClass,
  contactInitials,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import type { EmbeddedInsight } from '@/lib/intelligence/types'
import type { PortalAccessState } from '@/lib/portal/types'
import type { activities, contacts, records } from '@vantera/db'
import { Mail, Phone } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  insights: EmbeddedInsight[]
  portal: PortalAccessState
}

export function ContactProfile({
  contact,
  activities,
  relatedRecords,
  openRecordsCount,
  insights,
  portal,
}: Props) {
  const router = useRouter()
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
    router.refresh()
  }

  return (
    <DetailShell>
      <DetailBackLink href="/admin/clients" label={`Back to ${labels.contacts.toLowerCase()}`} />

      <DetailHeader
        eyebrow={labels.contact}
        title={name}
        subtitle={contact.email ?? undefined}
        avatar={
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${avatarColorClass(name)}`}
          >
            {contactInitials(contact.firstName, contact.lastName)}
          </span>
        }
        badges={
          <>
            <Badge className={CONTACT_TYPE_COLORS[contact.type]}>
              {CONTACT_TYPE_LABELS[contact.type]}
            </Badge>
            {(contact.tags ?? []).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
            {contact.churnRiskScore > 70 ? (
              <Badge variant="destructive">Churn risk {contact.churnRiskScore}</Badge>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {contact.phone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${contact.phone}`}>
                  <Phone className="mr-2 h-4 w-4" /> Call
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
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </div>
        }
      />

      <DetailLayout
        main={
          <>
            <DetailSection title="Profile">
              <DetailFieldGrid>
                <DetailField label="Email" value={contact.email} />
                <DetailField label="Phone" value={contact.phone} />
                <DetailField
                  label="Address"
                  value={[contact.addressLine1, contact.city, contact.state, contact.zip]
                    .filter(Boolean)
                    .join(', ')}
                />
                <DetailField label="Source" value={contact.source} />
                <DetailField
                  label="Created"
                  value={new Date(contact.createdAt).toLocaleDateString()}
                />
                <DetailField label="Churn risk" value={String(contact.churnRiskScore)} />
              </DetailFieldGrid>
            </DetailSection>

            <DetailSection title="Activity" subtitle="Messages, tasks, and system events">
              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="stages">Stage changes</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  <DetailTimeline items={activities} />
                </TabsContent>
                <TabsContent value="messages" className="mt-4">
                  <DetailTimeline
                    items={activities.filter((item) => item.activityType.includes('message'))}
                    emptyTitle="No messages yet"
                    emptyDescription="Client communication will appear here when logged or synced."
                  />
                </TabsContent>
                <TabsContent value="tasks" className="mt-4">
                  <DetailTimeline
                    items={activities.filter((item) => item.activityType.includes('task'))}
                    emptyTitle="No tasks logged"
                    emptyDescription="Delivery tasks and follow-ups will show up here."
                  />
                </TabsContent>
                <TabsContent value="stages" className="mt-4">
                  <DetailTimeline
                    items={activities.filter((item) => item.activityType.includes('stage'))}
                    emptyTitle="No stage changes"
                    emptyDescription="Pipeline and project stage updates appear here."
                  />
                </TabsContent>
              </Tabs>
            </DetailSection>

            <DetailSection
              title={`${labels.records} (${openRecordsCount})`}
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/records?contactId=${contact.id}`}>
                    Add {labels.record.toLowerCase()}
                  </Link>
                </Button>
              }
            >
              <div className="space-y-3">
                {relatedRecords.length === 0 ? (
                  <p className="text-[13px] text-stone-500">
                    No {labels.records.toLowerCase()} linked yet.
                  </p>
                ) : (
                  relatedRecords.map((record) => (
                    <Link
                      key={record.id}
                      href={`/admin/records/${record.id}`}
                      className="block rounded-lg border border-stone-200 p-4 transition-colors hover:border-stone-300 hover:bg-stone-50/80"
                    >
                      <p className="font-medium text-stone-900">{record.title}</p>
                      <p className="mt-1 text-[13px] text-stone-500">
                        {formatUsdFromCents(record.valueCents)}
                        {record.scheduledAt
                          ? ` · ${new Date(record.scheduledAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </DetailSection>
          </>
        }
        aside={
          <>
            <PortalAccessPanel contact={contact} portal={portal} />
            <DetailSection className="mt-5">
              <EmbeddedInsightsPanel
                insights={insights}
                title="Operational intelligence"
                subtitle="Churn, expansion, and delivery signals for this client."
              />
            </DetailSection>
          </>
        }
      />

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
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
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
    </DetailShell>
  )
}
