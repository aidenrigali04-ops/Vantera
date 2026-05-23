import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Business Operations Platform
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            White-label CRM, portal, and automation for service businesses
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Run sales, client communication, invoicing, and AI assistance under your own brand.
            Each account gets a dedicated subdomain with custom branding.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Sign in
          </Link>
          <a
            href="mailto:hello@vantera.app"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-muted"
          >
            Request access
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          Tenant administrators sign in at{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">your-slug.vantera.app</code>
        </p>
      </div>
    </main>
  )
}
