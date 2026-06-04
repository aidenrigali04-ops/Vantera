'use client'

import { PageHeader } from '@/components/operational/PageHeader'
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
import { inviteTeamMembers } from '@/app/(admin)/admin/onboarding/actions'
import {
  updateWorkspaceBranding,
  updateWorkspaceGeneral,
} from '@/lib/settings/actions'
import { OperatingModelPicker } from '@/components/onboarding/OperatingModelPicker'
import {
  OPERATING_MODELS,
  type OperatingModelId,
} from '@/lib/onboarding/operating-models'
import { saveOperatingModel } from '@/lib/onboarding/save-operating-model'
import {
  readOperatingModelId,
  writeOperatingModelId,
} from '@/lib/onboarding/operating-model-storage'
import { cn } from '@/lib/utils'
import {
  Calendar,
  CreditCard,
  ExternalLink,
  Mail,
  Palette,
  Plug,
  Settings2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type TeamMember = {
  id: string
  fullName: string
  email: string
  role: string
}

type AccountSettings = {
  name: string
  vertical: string
  plan: string
  timezone: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

type Props = {
  accountId: string
  sessionEmail: string
  sessionRole: string
  account: AccountSettings
  team: TeamMember[]
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

const INVITE_ROLES = ['admin', 'manager', 'staff', 'technician', 'agent'] as const

const NAV_SECTIONS = [
  { id: 'workspace', label: 'Workspace', icon: Settings2 },
  { id: 'operating-model', label: 'Operating model', icon: Settings2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'team', label: 'Team', icon: Users },
] as const

const NAV_LINKS = [
  { href: '/admin/portal', label: 'Client portal', icon: ExternalLink, tourAnchor: 'nav-portal' },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/integrations', label: 'Integrations', icon: Plug },
] as const

type SectionId = (typeof NAV_SECTIONS)[number]['id']

export function SettingsPageClient({
  accountId,
  sessionEmail,
  sessionRole,
  account,
  team,
}: Props) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>('workspace')
  const [isPending, startTransition] = useTransition()

  const [workspaceName, setWorkspaceName] = useState(account.name)
  const [timezone, setTimezone] = useState(account.timezone || 'America/New_York')
  const [primaryColor, setPrimaryColor] = useState(account.primaryColor)
  const [secondaryColor, setSecondaryColor] = useState(account.secondaryColor)
  const [logoUrl, setLogoUrl] = useState(account.logoUrl ?? '')
  const [operatingModelId, setOperatingModelId] = useState<OperatingModelId>('agency_ops')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>('staff')

  useEffect(() => {
    const stored = readOperatingModelId(accountId)
    if (stored) {
      setOperatingModelId(stored)
      return
    }
    const match = OPERATING_MODELS.find((model) => model.vertical === account.vertical)
    if (match) setOperatingModelId(match.id)
  }, [account.vertical, accountId])

  function saveWorkspace() {
    startTransition(async () => {
      const result = await updateWorkspaceGeneral({ name: workspaceName, timezone })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Workspace updated')
      router.refresh()
    })
  }

  function saveBranding() {
    startTransition(async () => {
      const result = await updateWorkspaceBranding({
        logoUrl: logoUrl.trim() || null,
        primaryColor,
        secondaryColor,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Branding updated')
      router.refresh()
    })
  }

  function saveOperatingModelSelection() {
    startTransition(async () => {
      const result = await saveOperatingModel(operatingModelId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      writeOperatingModelId(accountId, operatingModelId)
      toast.success('Operating model updated')
      router.refresh()
    })
  }

  function sendInvite() {
    const email = inviteEmail.trim()
    if (!email) return

    startTransition(async () => {
      const result = await inviteTeamMembers(accountId, [{ email, role: inviteRole }])
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Invite sent to ${email}`)
      setInviteEmail('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace configuration, branding, operating model, and team access."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <nav
          className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
          aria-label="Settings sections"
        >
          {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                activeSection === id
                  ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                  : 'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
          <p className="hidden px-3 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] lg:block">
            Workspace tools
          </p>
          {NAV_LINKS.map(({ href, label, icon: Icon, ...linkMeta }) => (
            <Link
              key={href}
              href={href}
              data-tour={'tourAnchor' in linkMeta ? linkMeta.tourAnchor : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-6">
          {activeSection === 'workspace' ? (
            <SettingsPanel
              title="Workspace"
              description="Name and timezone shown across your operating system."
              onSave={saveWorkspace}
              saving={isPending}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    className="mt-1.5 max-w-md"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" className="mt-1.5 max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-stone-100 bg-stone-50/80 px-4 py-3 text-[13px] text-stone-600">
                  <p>
                    Signed in as <span className="font-medium text-stone-900">{sessionEmail}</span>{' '}
                    · {sessionRole}
                  </p>
                  <p className="mt-1 capitalize">Plan: {account.plan}</p>
                </div>
              </div>
            </SettingsPanel>
          ) : null}

          {activeSection === 'operating-model' ? (
            <SettingsPanel
              title="Operating model"
              description="Choose how you run the business — we tailor pipeline language, dashboard focus, and templates."
              onSave={saveOperatingModelSelection}
              saving={isPending}
              saveLabel="Save operating model"
            >
              <OperatingModelPicker
                selected={operatingModelId}
                onSelect={setOperatingModelId}
              />
            </SettingsPanel>
          ) : null}

          {activeSection === 'branding' ? (
            <SettingsPanel
              title="Branding"
              description="Logo, colors, and client portal domain."
              onSave={saveBranding}
              saving={isPending}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="logo-url">Logo URL</Label>
                  <Input
                    id="logo-url"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    placeholder="https://…"
                    className="mt-1.5 max-w-md"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="primary-color">Primary color</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        id="primary-color"
                        value={primaryColor}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                        className="max-w-[140px] font-mono text-[13px]"
                      />
                      <span
                        className="h-9 w-9 rounded-lg border border-stone-200"
                        style={{ backgroundColor: primaryColor }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="secondary-color">Secondary color</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        id="secondary-color"
                        value={secondaryColor}
                        onChange={(event) => setSecondaryColor(event.target.value)}
                        className="max-w-[140px] font-mono text-[13px]"
                      />
                      <span
                        className="h-9 w-9 rounded-lg border border-stone-200"
                        style={{ backgroundColor: secondaryColor }}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-stone-500">
                  Use your own hostname for client sign-in (e.g.{' '}
                  <code className="rounded bg-stone-100 px-1 text-xs">portal.yourcompany.com</code>) — configure
                  DNS in{' '}
                  <Link href="/admin/portal#portal-domain" className="font-medium text-stone-800 underline">
                    Client portal → Portal domain
                  </Link>
                  .
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/portal/preview">Preview client portal →</Link>
                </Button>
              </div>
            </SettingsPanel>
          ) : null}

          {activeSection === 'team' ? (
            <SettingsPanel
              title="Team"
              description="People with access to this workspace."
              showSaveButton={false}
            >
              <div className="space-y-5">
                <div className="overflow-hidden rounded-xl border border-stone-200">
                  <table className="w-full text-[13px]">
                    <thead className="border-b border-stone-200 bg-stone-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-stone-500">Name</th>
                        <th className="px-4 py-2.5 text-left font-medium text-stone-500">Email</th>
                        <th className="px-4 py-2.5 text-left font-medium text-stone-500">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {team.map((member) => (
                        <tr key={member.id}>
                          <td className="px-4 py-3 font-medium text-stone-900">{member.fullName}</td>
                          <td className="px-4 py-3 text-stone-600">{member.email}</td>
                          <td className="px-4 py-3 capitalize text-stone-600">{member.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-4">
                  <p className="text-sm font-medium text-stone-800">Invite teammate</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="name@company.com"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="w-full sm:w-[160px]">
                      <Label htmlFor="invite-role">Role</Label>
                      <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as typeof inviteRole)}>
                        <SelectTrigger id="invite-role" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVITE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={sendInvite}
                      disabled={isPending || !inviteEmail.trim()}
                      className="bg-stone-900 hover:bg-stone-800"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send invite
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsPanel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type SettingsPanelProps = {
  title: string
  description: string
  children: React.ReactNode
  onSave?: () => void
  saving?: boolean
  saveLabel?: string
  showSaveButton?: boolean
}

function SettingsPanel({
  title,
  description,
  children,
  onSave,
  saving = false,
  saveLabel = 'Save changes',
  showSaveButton = true,
}: SettingsPanelProps) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        </div>
        {showSaveButton && onSave ? (
          <Button
            onClick={onSave}
            disabled={saving}
            className="shrink-0 bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
          >
            {saving ? 'Saving…' : saveLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  )
}
