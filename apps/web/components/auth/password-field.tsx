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
  weak: 'bg-red-500',
  medium: 'bg-amber-400',
  strong: 'bg-emerald-500',
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
            'flex h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 pr-10 text-[15px] text-stone-900 shadow-sm transition-colors',
            'placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/10',
            ariaInvalid && 'border-red-500 focus-visible:ring-red-500/20',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && strength ? (
        <div className="space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-stone-100">
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
