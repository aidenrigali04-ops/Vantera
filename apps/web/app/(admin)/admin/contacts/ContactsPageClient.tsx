'use client'

import { createContact, archiveContact } from '@/app/(admin)/admin/contacts/actions'
import { ContactsTable, type ContactRow } from '@/components/admin/contacts/ContactsTable'
import type { AdminSession } from '@/lib/auth/types'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { useUIStore } from '@/lib/stores/ui-store'
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
import { CONTACT_TYPE_LABELS } from '@/lib/contacts/format'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  initialContacts: ContactRow[]
  session: AdminSession
  vertical: string
  typeCounts: Record<string, number>
  basePath?: string
}

export function ContactsPageClient({
  initialContacts,
  session,
  typeCounts,
  basePath = '/admin/crm/clients',
}: Props) {
  const labels = useVerticalLabels()
  const queryClient = useQueryClient()
  const { selectedContactIds, setSelectedContactIds, clearContactSelection } = useUIStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [atRisk, setAtRisk] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    type: 'customer' as const,
  })

  const queryKey = ['contacts', session.accountId, search, typeFilter, atRisk, basePath]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('lifecycleStage', 'active_client')
      if (search) params.set('search', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (atRisk) params.set('atRisk', 'true')
      const res = await fetch(`/api/contacts?${params.toString()}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load contacts')
      return json.data as ContactRow[]
    },
    initialData: initialContacts,
  })

  const handleCreate = async () => {
    setCreating(true)
    const result = await createContact(form)
    setCreating(false)

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`${labels.contact} created`)
    setCreateOpen(false)
    setForm({ firstName: '', lastName: '', email: '', phone: '', type: 'customer' })
    await queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  const handleArchive = useCallback(
    async (id: string) => {
      const result = await archiveContact(id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${labels.contact} archived`)
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    [labels.contact, queryClient],
  )

  const totalSelected = selectedContactIds.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-stone-900">{labels.contacts}</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add {labels.contact}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={`Search ${labels.contacts.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            All ({Object.values(typeCounts).reduce((a, b) => a + b, 0) || data.length})
          </FilterPill>
          {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
            <FilterPill
              key={key}
              active={typeFilter === key}
              onClick={() => setTypeFilter(key)}
            >
              {label}
              {typeCounts[key] ? ` (${typeCounts[key]})` : ''}
            </FilterPill>
          ))}
        </div>
        <FilterPill active={atRisk} onClick={() => setAtRisk((v) => !v)}>
          At Risk
        </FilterPill>
      </div>

      <ContactsTable
        data={data}
        isLoading={isLoading}
        selectedIds={selectedContactIds}
        onSelectionChange={setSelectedContactIds}
        onArchive={handleArchive}
        contactLabel={labels.contact}
        contactsLabel={labels.contacts}
        onAddContact={() => setCreateOpen(true)}
        basePath={basePath}
      />

      {totalSelected > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-stone-900 px-6 py-3 text-white shadow-2xl">
          <span className="text-sm font-medium">{totalSelected} selected</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info('Bulk tag — coming in Phase 1.6')}
          >
            Tag
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info('Bulk assign — coming in Phase 1.6')}
          >
            Assign
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toast.info('Export CSV')}>
            Export
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              for (const id of selectedContactIds) {
                await handleArchive(id)
              }
              clearContactSelection()
            }}
          >
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={clearContactSelection}>
            Clear
          </Button>
        </div>
      ) : null}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add {labels.contact}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as typeof form.type }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleCreate} disabled={creating || !form.firstName || !form.lastName}>
              {creating ? 'Saving...' : `Create ${labels.contact}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white'
          : 'rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50'
      }
    >
      {children}
    </button>
  )
}
