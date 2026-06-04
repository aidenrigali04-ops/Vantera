type PortalPageHeaderProps = {
  title: string
  subtitle?: string
  eyebrow?: string
}

export function PortalPageHeader({ title, subtitle, eyebrow }: PortalPageHeaderProps) {
  return (
    <header className="mb-8">
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
