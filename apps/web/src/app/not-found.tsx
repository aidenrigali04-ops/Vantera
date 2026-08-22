import Link from "next/link";

/**
 * R1c: branded 404 — replaces Next's bare default. Serves both marketing URLs and
 * app deep-links (a bad /prospects/{id} lands here via notFound()).
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--tint,#fbfcfe)] px-6 text-center">
      <div className="max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          That page doesn&apos;t exist.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The link may be old, or the record it pointed to was removed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 text-sm font-medium">
          <Link
            href="/dashboard"
            className="rounded-lg bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90"
          >
            Go to your dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-[var(--hairline,#e3e9f2)] px-4 py-2 text-foreground transition-colors hover:bg-foreground/[0.04]"
          >
            Vantera home
          </Link>
        </div>
      </div>
    </div>
  );
}
