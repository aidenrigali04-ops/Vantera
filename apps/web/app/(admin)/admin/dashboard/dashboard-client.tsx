'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminLogoutAction } from '@/lib/auth/actions'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import { useMemo } from 'react'

type DashboardClientProps = {
  email: string
  role: string
  businessName: string
  snapshot: DashboardSnapshot
}

function formatCurrency(cents: number): string {
  if (!cents) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

function Header({
  businessName,
  email,
  role,
}: {
  businessName: string
  email: string
  role: string
}) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{businessName}</h1>
          <p className="truncate text-xs text-muted-foreground">
            Signed in as {email} · {role}
          </p>
        </div>
        <form action={adminLogoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}

export function DashboardClient({ email, role, businessName, snapshot }: DashboardClientProps) {
  const {
    clients,
    deals,
    projects,
    isEmpty,
    pipelineValueCents,
    weightedPipelineValueCents,
    wonValueCents,
  } = snapshot

  const openDeals = useMemo(
    () => deals.filter((d) => !d.isTerminalWin && !d.isTerminalLoss),
    [deals],
  )

  const pipelineColumns = useMemo(() => {
    const byStage = new Map<
      string,
      { label: string; color: string; position: number; deals: typeof deals }
    >()
    for (const d of deals) {
      if (d.isTerminalLoss) continue
      const existing = byStage.get(d.stageLabel) ?? {
        label: d.stageLabel,
        color: d.stageColor,
        position: d.stagePosition,
        deals: [],
      }
      existing.deals.push(d)
      byStage.set(d.stageLabel, existing)
    }
    return Array.from(byStage.values()).sort((a, b) => a.position - b.position)
  }, [deals])

  if (isEmpty) {
    return (
      <div className="min-h-full">
        <Header businessName={businessName} email={email} role={role} />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8"
              aria-hidden
            >
              <path d="M18 21a8 8 0 0 0-16 0" />
              <circle cx="10" cy="8" r="5" />
              <path d="m22 11-2 2-2-2" />
              <path d="M20 13V7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Your workspace is empty</h2>
          <p className="mt-2 text-muted-foreground">
            Add your first client to start building your pipeline. The stages and structure are
            ready — you just bring the people.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button disabled>Add your first client</Button>
            <Button variant="outline" disabled>
              Import from CSV (coming soon)
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            CRUD pages ship next — your pipeline stages are already saved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <Header businessName={businessName} email={email} role={role} />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Welcome — your workspace is ready to explore.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            This is a working dashboard with sample clients, deals, and projects so you can see how
            pipeline, clients, and delivery connect. When you&rsquo;re ready, replace it with your
            own data.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="Active clients" value={clients.length.toString()} />
          <KpiTile label="Open deals" value={openDeals.length.toString()} />
          <KpiTile label="Pipeline value" value={formatCurrency(pipelineValueCents)} />
          <KpiTile
            label="Weighted pipeline"
            value={formatCurrency(weightedPipelineValueCents)}
            sub={wonValueCents ? `${formatCurrency(wonValueCents)} won` : undefined}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Deals across each stage. Click any card to drill in (drill-in pages ship next).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {pipelineColumns.map((col) => (
                <div key={col.label} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ background: col.color }}
                    />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {col.label}
                    </span>
                    <Badge variant="secondary" className="ml-auto">
                      {col.deals.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {col.deals.length === 0 ? (
                      <div className="rounded-md border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                        No deals
                      </div>
                    ) : (
                      col.deals.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-md border bg-card p-3 text-sm shadow-sm transition hover:shadow"
                        >
                          <div className="font-medium leading-tight">{d.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{d.contactName}</div>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="font-medium">{formatCurrency(d.valueCents)}</span>
                            <span className="text-muted-foreground">{d.closeProbability}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-end justify-between gap-2">
              <div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>{clients.length} active</CardDescription>
              </div>
              <Button size="sm" variant="ghost" disabled>
                View all
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {clients.map((c) => {
                  const company = c.source ?? `${c.firstName} ${c.lastName}`
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{company}</p>
                          {c.isSample ? (
                            <Badge variant="outline" className="text-[10px]">
                              Sample
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.firstName} {c.lastName}
                          {c.email ? ` · ${c.email}` : ''}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" disabled>
                        View
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active projects</CardTitle>
              <CardDescription>{projects.length} in flight</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active projects.</p>
              ) : (
                <ul className="space-y-3">
                  {projects.map((p) => (
                    <li key={p.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{p.title}</p>
                        {p.isSample ? (
                          <Badge variant="outline" className="text-[10px]">
                            Sample
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.contactName}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="secondary">{p.stageLabel}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(p.valueCents)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  )
}
