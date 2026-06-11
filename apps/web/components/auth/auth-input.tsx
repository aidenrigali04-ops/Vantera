import { cn } from '@/lib/utils'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

/** Auth column text field — matches the saas-design-system light form spec. */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-sm)]',
          'placeholder:text-[var(--text-tertiary)] transition-[border-color,box-shadow] duration-150',
          'focus-visible:border-[var(--accent-border)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          invalid && 'border-[var(--danger)] focus-visible:ring-[var(--danger-muted)]',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)

AuthInput.displayName = 'AuthInput'

export function AuthFieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--text-secondary)]">
      {children}
    </label>
  )
}

export function AuthFieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-[13px] text-[var(--danger)]" role="alert">
      {message}
    </p>
  )
}
