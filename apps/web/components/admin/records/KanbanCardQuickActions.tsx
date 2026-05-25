'use client'

import { updateRecord } from '@/app/(admin)/admin/records/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { RecordWithRelations } from '@/lib/records/format'
import type { stageDefinitions, users } from '@vantera/db'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  record: RecordWithRelations
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  onUpdated: () => void
  onArchive: () => void
}

export function KanbanCardQuickActions({ record, stages, users, onUpdated, onArchive }: Props) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [channel, setChannel] = useState<'sms' | 'email' | 'portal'>('sms')
  const [message, setMessage] = useState('')
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null)

  const handleStageChange = async (stageId: string) => {
    setLoadingStageId(stageId)
    const result = await updateRecord(record.id, { stageId })
    setLoadingStageId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Stage updated')
    onUpdated()
  }

  const handleAssign = async (userId: string) => {
    const result = await updateRecord(record.id, { assignedUserId: userId })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Assignee updated')
    onUpdated()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {record.contact?.phone ? (
            <DropdownMenuItem asChild>
              <a href={`tel:${record.contact.phone}`}>Call</a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => {
              setChannel('sms')
              setComposeOpen(true)
            }}
          >
            Text
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setChannel('email')
              setComposeOpen(true)
            }}
          >
            Email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <StagePickerPopover
            stages={stages.filter((s) => s.id !== record.stageId)}
            loadingStageId={loadingStageId}
            onSelect={handleStageChange}
          />
          <UserPickerPopover userList={users} onSelect={handleAssign} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Send message</SheetTitle>
          </SheetHeader>
          <Tabs value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <TabsList className="mt-4">
              <TabsTrigger value="sms">SMS</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="portal">Portal</TabsTrigger>
            </TabsList>
            <TabsContent value={channel} className="mt-4 space-y-3">
              <div>
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={channel === 'sms' ? 160 : undefined}
                  rows={4}
                />
                {channel === 'sms' ? (
                  <p className="mt-1 text-xs text-stone-500">{message.length}/160</p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
          <SheetFooter className="mt-4">
            <Button
              onClick={() => {
                toast.info('Message queued — Phase 2 delivery')
                setComposeOpen(false)
                setMessage('')
              }}
              disabled={!message.trim()}
            >
              Send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function StagePickerPopover({
  stages,
  loadingStageId,
  onSelect,
}: {
  stages: (typeof stageDefinitions.$inferSelect)[]
  loadingStageId: string | null
  onSelect: (stageId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Move Stage</DropdownMenuItem>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100"
            onClick={() => onSelect(stage.id)}
          >
            {loadingStageId === stage.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
            )}
            {stage.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function UserPickerPopover({
  userList,
  onSelect,
}: {
  userList: (typeof users.$inferSelect)[]
  onSelect: (userId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Assign</DropdownMenuItem>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end">
        {userList.map((user) => (
          <button
            key={user.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100"
            onClick={() => onSelect(user.id)}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs">
              {user.fullName.slice(0, 1)}
            </span>
            {user.fullName}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
