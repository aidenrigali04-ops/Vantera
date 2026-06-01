import type { ReactNode } from 'react'

type AuthLayoutProps = {
  children: ReactNode
}

/**
 * Split-column auth shell.
 *
 * Left column (always visible): branded form area.
 * Right column (hidden on small viewports): calm hero panel with
 * structural cues — three labeled tiles that telegraph the "operating
 * system" idea without leaning into marketing imagery.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <div className="flex w-full items-center justify-center px-4 py-12 sm:px-8 lg:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#0B1220] lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, #1648A0, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 size-[24rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle at center, #0D9488, transparent 70%)' }}
        />

        <div className="relative z-10 flex w-full flex-col justify-between px-12 py-16 text-white">
          <div className="max-w-md space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/70">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
              One workspace
            </span>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              Run Your Business From One System
            </h2>
            <p className="text-base leading-relaxed text-white/70">
              Centralizes your revenue, operations, and client delivery into one structured
              workspace.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-12">
            <HeroTile label="Clients" caption="Real people, one source of truth" />
            <HeroTile label="Pipeline" caption="Opportunities across every stage" />
            <HeroTile label="Projects" caption="Delivery wired to clients" />
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroTile({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-2 text-xs leading-snug text-white/80">{caption}</div>
      <div className="mt-3 flex gap-1">
        <span className="h-1 w-6 rounded-full bg-white/30" />
        <span className="h-1 w-3 rounded-full bg-white/15" />
        <span className="h-1 w-4 rounded-full bg-white/15" />
      </div>
    </div>
  )
}
