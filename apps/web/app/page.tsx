import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Automated Sales Intelligence
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Build your SDR Agents
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Deploy AI agents that find, contact, and nurture leads around the clock — without
            adding headcount. Your pipeline never sleeps.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth"
            className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Create account
          </Link>
          <Link
            href="/auth?mode=login"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Tenant administrators sign in at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">your-slug.vantera.app</code>
        </p>
      </div>
    </main>
  )
}
