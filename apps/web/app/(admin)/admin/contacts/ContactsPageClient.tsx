'use client'

import { archiveContact, createContact, updateContact } from '@/app/(admin)/admin/contacts/actions'
import { BulkActionBar } from '@/components/operational/BulkActionBar'
import {
  OperationalTable,
  type OperationalSort,
} from '@/components/operational/OperationalTable'
import { PageHeader } from '@/components/operational/PageHeader'
import { TableInlineInput } from '@/components/operational/table/TableInlineInput'
import { TableInlineSelect } from '@/components/operational/table/TableInlineSelect'
import { TableSavedViews } from '@/components/operational/table/TableSavedViews'
import { TableToolbar } from '@/components/operational/table/TableToolbar'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { Badge } from '@/components/ui/badge'
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
import type { AdminSession } from '@/lib/auth/types'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import {
  avatarColorClass,
  CONTACT_TYPE_LABELS,
  contactInitials,
  formatRelativeTime,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import type { ContactRow } from '@/lib/contacts/types'
import { CONTACTS_TABLE_VIEWS } from '@/lib/operational/contacts-table-views'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  initialContacts: ContactRow[]
  session: AdminSession
  typeCounts: Record<string, number>
  basePath?: string
  setupMode?: boolean
}

const TYPE_OPTIONS = Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

function contactDisplayName(row: ContactRow): string {
  return `${row.firstName} ${row.lastName}`.trim()
}

export function ContactsPageClient({
  initialContacts,
  session,
  typeCounts,
  basePath = '/admin/clients',
  setupMode = false,
}: Props) {
  const labels = useVerticalLabels()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setNewClientDrawerOpen } = useOnboardingStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [atRisk, setAtRisk] = useState(false)
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sort, setSort] = useState<OperationalSort | null>({
    columnId: 'updatedAt',
    direction: 'desc',
  })
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

  const { data: contactsData = initialContacts, isLoading } = useQuery({
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

  const sortedContacts = useMemo(() => {
    if (!sort) return contactsData
    const copy = [...contactsData]
    copy.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort.columnId) {
        case 'name':
          av = contactDisplayName(a).toLowerCase()
          bv = contactDisplayName(b).toLowerCase()
          break
        case 'type':
          av = a.type
          bv = b.type
          break
        case 'email':
          av = (a.email ?? '').toLowerCase()
          bv = (b.email ?? '').toLowerCase()
          break
        case 'ltv':
          av = a.ltvCents ?? 0
          bv = b.ltvCents ?? 0
          break
        case 'churnRisk':
          av = a.churnRiskScore ?? 0
          bv = b.churnRiskScore ?? 0
          break
        case 'updatedAt':
          av = new Date(a.updatedAt).getTime()
          bv = new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }
      if (av < bv) return sort.direction === 'asc' ? -1 : 1
      if (av > bv) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [contactsData, sort])

  function applySavedView(viewId: string) {
    const view = CONTACTS_TABLE_VIEWS.find((item) => item.id === viewId)
    if (!view) return
    setActiveViewId(viewId)
    setTypeFilter(view.type)
    setAtRisk(view.atRisk)
  }

  const handleTypeChange = useCallback(
    async (contactId: string, type: string) => {
      const previous = queryClient.getQueryData<ContactRow[]>(queryKey)
      queryClient.setQueryData<ContactRow[]>(queryKey, (old) =>
        old?.map((row) =>
          row.id === contactId ? { ...row, type: type as ContactRow['type'] } : row,
        ),
      )

      const result = await updateContact(contactId, { type: type as ContactRow['type'] })

      if (!result.success) {
        queryClient.setQueryData(queryKey, previous)
        toast.error(result.error ?? 'Could not update type')
        return
      }

      toast.success('Type updated')
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    [queryClient, queryKey],
  )

  const handleEmailChange = useCallback(
    async (contactId: string, email: string) => {
      const previous = queryClient.getQueryData<ContactRow[]>(queryKey)
      queryClient.setQueryData<ContactRow[]>(queryKey, (old) =>
        old?.map((row) => (row.id === contactId ? { ...row, email: email || null } : row)),
      )

      const result = await updateContact(contactId, { email })

      if (!result.success) {
        queryClient.setQueryData(queryKey, previous)
        toast.error(result.error ?? 'Could not update email')
        return
      }

      toast.success('Email updated')
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    [queryClient, queryKey],
  )

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
      setSelectedIds((ids) => ids.filter((x) => x !== id))
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    [labels.contact, queryClient],
  )

  const typeFilterOptions = useMemo(() => {
    const total = Object.values(typeCounts).reduce((a, b) => a + b, 0) || contactsData.length
    return [
      { value: 'all', label: `All types (${total})` },
      ...TYPE_OPTIONS.map(({ value, label }) => ({
        value,
        label: typeCounts[value] ? `${label} (${typeCounts[value]})` : label,
      })),
    ]
  }, [contactsData.length, typeCounts])

  const columns = useMemo(
    () => [
      {
        id: 'avatar',
        header: '',
        cell: (row: ContactRow) => {
          const name = contactDisplayName(row)
          return (
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                avatarColorClass(name),
              )}
            >
              {contactInitials(row.firstName, row.lastName)}
            </span>
          )
        },
      },
      {
        id: 'name',
        header: 'Name',
        sortable: true,
        cell: (row: ContactRow) => (
          <div>
            <p className="font-medium text-stone-900">{contactDisplayName(row)}</p>
            {row.phone ? (
              <p className="text-[12px] text-stone-500">{row.phone}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        sortable: true,
        interactive: true,
        cell: (row: ContactRow) => (
          <TableInlineSelect
            value={row.type}
            options={TYPE_OPTIONS}
            onSave={(value) => handleTypeChange(row.id, value)}
            triggerClassName="min-w-[120px]"
          />
        ),
      },
      {
        id: 'email',
        header: 'Email',
        sortable: true,
        interactive: true,
        cell: (row: ContactRow) => (
          <TableInlineInput
            value={row.email}
            type="email"
            placeholder="Add email…"
            onSave={(value) => handleEmailChange(row.id, value)}
          />
        ),
      },
      {
        id: 'ltv',
        header: 'LTV',
        sortable: true,
        cell: (row: ContactRow) => (
          <span className="tabular-nums font-medium text-stone-800">
            {formatUsdFromCents(row.ltvCents)}
          </span>
        ),
      },
      {
        id: 'churnRisk',
        header: 'Churn risk',
        sortable: true,
        cell: (row: ContactRow) => {
          const score = row.churnRiskScore
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={cn(
                    'h-full rounded-full',
                    score > 70 ? 'bg-red-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-stone-500">{score}</span>
            </div>
          )
        },
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: (row: ContactRow) => {
          const tags = row.tags ?? []
          const visible = tags.slice(0, 2)
          const overflow = tags.length - visible.length
          return (
            <div className="flex flex-wrap gap-1">
              {visible.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                  {tag}
                </Badge>
              ))}
              {overflow > 0 ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  +{overflow}
                </Badge>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'updatedAt',
        header: 'Last activity',
        sortable: true,
        cell: (row: ContactRow) => (
          <span className="text-stone-600">{formatRelativeTime(row.updatedAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        interactive: true,
        className: 'text-right',
        cell: (row: ContactRow) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`${basePath}/${row.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleArchive(row.id)}>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [basePath, handleArchive, handleEmailChange, handleTypeChange],
  )

  const openCreate = () => {
    if (setupMode) {
      setNewClientDrawerOpen(true)
      return
    }
    setCreateOpen(true)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={labels.contacts}
        description={`Active ${labels.contacts.toLowerCase()} — edit type and email inline without leaving the table.`}
        actions={
          <Button onClick={openCreate} className="bg-stone-900 hover:bg-stone-800">
            <Plus className="mr-2 h-4 w-4" />
            Add {labels.contact}
          </Button>
        }
      />

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${labels.contacts.toLowerCase()}…`}
        savedViews={
          <TableSavedViews
            views={CONTACTS_TABLE_VIEWS}
            activeViewId={activeViewId}
            onViewChange={applySavedView}
          />
        }
        filters={[
          {
            id: 'type',
            label: 'Type',
            value: typeFilter,
            onChange: (value) => {
              setTypeFilter(value)
              setActiveViewId('custom')
            },
            options: typeFilterOptions,
            widthClassName: 'w-[168px]',
          },
          {
            id: 'atRisk',
            label: 'Risk',
            value: atRisk ? 'true' : 'all',
            onChange: (value) => {
              setAtRisk(value === 'true')
              setActiveViewId('custom')
            },
            options: [
              { value: 'all', label: 'All risk levels' },
              { value: 'true', label: 'At risk only' },
            ],
            widthClassName: 'w-[148px]',
          },
        ]}
      />

      <OperationalTable
        columns={columns}
        rows={sortedContacts}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
        sort={sort}
        onSortChange={setSort}
        loading={isLoading}
        emptyState={
          setupMode ? (
            <SectionEmptyState
              title="No clients yet"
              description="Add your first client to start tracking opportunities and delivery work against them."
              actionLabel="Add my first client"
              onAction={() => setNewClientDrawerOpen(true)}
            />
          ) : (
            <SectionEmptyState
              title={`No ${labels.contacts.toLowerCase()} yet`}
              description={`Add your first ${labels.contact.toLowerCase()} to start tracking relationships.`}
              actionLabel={`Add ${labels.contact}`}
              onAction={openCreate}
            />
          )
        }
      />

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="sm" variant="secondary" onClick={() => toast.info('Bulk tag — coming soon')}>
          Tag
        </Button>
        <Button size="sm" variant="secondary" onClick={() => toast.info('Bulk assign — coming soon')}>
          Assign
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.info('Export CSV — coming soon')}>
          Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            for (const id of selectedIds) {
              await handleArchive(id)
            }
            setSelectedIds([])
          }}
        >
          Archive
        </Button>
      </BulkActionBar>

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
                  {TYPE_OPTIONS.map(({ value, label }) => (
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
