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
          'flex h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-[15px] text-stone-900 shadow-sm',
          'placeholder:text-stone-400 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-60',
          invalid && 'border-red-500 focus-visible:ring-red-500/20',
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
    <label htmlFor={htmlFor} className="text-[13px] font-medium text-stone-700">
      {children}
    </label>
  )
}

export function AuthFieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="text-[13px] text-red-600" role="alert">
      {message}
    </p>
  )
}
