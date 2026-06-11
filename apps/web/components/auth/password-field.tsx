'use client'

import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'

export type PasswordStrength = 'weak' | 'medium' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (/\d/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (score <= 1) return 'weak'
  if (score <= 2) return 'medium'
  return 'strong'
}

const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: 'bg-[var(--danger)]',
  medium: 'bg-[var(--warning)]',
  strong: 'bg-[var(--success)]',
}

type PasswordFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete?: 'new-password' | 'current-password'
  placeholder?: string
  showStrength?: boolean
  enterKeyHint?: 'next' | 'done' | 'go' | 'send'
  'aria-invalid'?: boolean
  disabled?: boolean
}

export function PasswordField({
  id,
  value,
  onChange,
  onBlur,
  autoComplete = 'new-password',
  placeholder = '••••••••',
  showStrength = false,
  enterKeyHint = 'done',
  'aria-invalid': ariaInvalid,
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const strength = useMemo(() => getPasswordStrength(value), [value])

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'flex h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 pr-10 text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150',
            'placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--accent-border)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
            ariaInvalid && 'border-[var(--danger)] focus-visible:ring-[var(--danger-muted)]',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && strength ? (
        <div className="space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-overlay)]">
            <div
              className={cn('h-full rounded-full transition-all', STRENGTH_COLORS[strength])}
              style={{
                width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
