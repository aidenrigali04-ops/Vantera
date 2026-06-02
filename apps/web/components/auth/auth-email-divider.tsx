/** Muted divider between social providers and the email form. */
export function AuthEmailDivider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-[var(--border-default)]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-secondary)]">
          or continue with email
        </span>
      </div>
    </div>
  )
}
