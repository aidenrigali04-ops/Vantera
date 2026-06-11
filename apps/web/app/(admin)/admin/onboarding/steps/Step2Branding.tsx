'use client'

import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import imageCompression from 'browser-image-compression'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { updateBranding } from '../actions'
import {
  FieldGroup,
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

const MAX_BYTES = 2 * 1024 * 1024
const COMPRESS_OVER_BYTES = 500 * 1024
const ACCEPTED = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
}
const HEX = /^#[0-9a-fA-F]{6}$/

type Props = {
  accountId: string
  businessName: string
  initialLogoUrl: string | null
  initialPrimary: string
  initialSecondary: string
  onComplete: (data: {
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
  }) => void
}

export function Step2Branding({
  accountId,
  businessName,
  initialLogoUrl,
  initialPrimary,
  initialSecondary,
  onComplete,
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoUploading, setLogoUploading] = useState(false)
  const [primary, setPrimary] = useState(initialPrimary)
  const [secondary, setSecondary] = useState(initialSecondary)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (HEX.test(primary)) {
      document.documentElement.style.setProperty('--brand-primary', primary)
    }
  }, [primary])

  useEffect(() => {
    if (HEX.test(secondary)) {
      document.documentElement.style.setProperty('--brand-secondary', secondary)
    }
  }, [secondary])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0]

      if (!file) {
        return
      }

      if (file.size > MAX_BYTES) {
        setError('Logo must be 2MB or smaller')
        return
      }

      setError(null)
      setLogoUploading(true)

      try {
        let toUpload: File | Blob = file

        if (file.size > COMPRESS_OVER_BYTES && file.type !== 'image/svg+xml') {
          toUpload = await imageCompression(file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
          })
        }

        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
        const path = `${accountId}/logo/logo.${ext}`
        const supabase = createSupabaseBrowserClient()

        const { error: uploadError } = await supabase.storage
          .from('vantera-assets')
          .upload(path, toUpload, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          setError(uploadError.message)
          setLogoUploading(false)
          return
        }

        const { data } = supabase.storage.from('vantera-assets').getPublicUrl(path)
        setLogoUrl(`${data.publicUrl}?t=${Date.now()}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Logo upload failed')
      } finally {
        setLogoUploading(false)
      }
    },
    [accountId],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: false,
    maxSize: MAX_BYTES,
  })

  const submit = useCallback(async (): Promise<boolean> => {
    if (!HEX.test(primary)) {
      setError('Primary color must be a 6-digit hex')
      return false
    }

    if (!HEX.test(secondary)) {
      setError('Secondary color must be a 6-digit hex')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() =>
        updateBranding(accountId, {
          logoUrl: logoUrl,
          primaryColor: primary,
          secondaryColor: secondary,
        }),
      )

      if (!result || result.success !== true) {
        const msg =
          (result && 'error' in result && result.error) ||
          'Could not save your branding. Please try again.'
        setError(msg)
        return false
      }

      onComplete({
        logoUrl,
        primaryColor: primary,
        secondaryColor: secondary,
      })
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      console.error('[Step2Branding] updateBranding threw', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [accountId, logoUrl, onComplete, primary, secondary])

  useRegisterOnboardingStep({
    canAdvance: HEX.test(primary) && HEX.test(secondary),
    isSubmitting: saving || logoUploading,
    submit,
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-4">
      <FieldGroup label="Logo">
        <div
          {...getRootProps()}
          className={cn(
            'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm transition-colors duration-[120ms]',
            isDragActive
              ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)]'
              : 'border-[var(--border-default)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-overlay)]',
          )}
        >
          <input {...getInputProps()} />
          <span
            aria-hidden
            style={{
              background: `linear-gradient(135deg, ${primary}33, ${primary}0a)`,
              boxShadow: `inset 0 0 0 1px ${primary}33`,
            }}
            className="flex h-12 w-12 items-center justify-center rounded-xl"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo preview" className="h-9 w-9 object-contain" />
            ) : (
              <Upload className="h-5 w-5" style={{ color: primary }} aria-hidden />
            )}
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {logoUploading
                ? 'Uploading…'
                : logoUrl
                  ? 'Drag a new file or click to replace'
                  : 'Drag your logo here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">PNG, JPG, WebP, or SVG · up to 2MB</p>
          </div>
        </div>
      </FieldGroup>

      <motion.section variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorField label="Primary color" value={primary} onChange={setPrimary} />
        <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
      </motion.section>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const valid = HEX.test(value)
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[var(--text-primary)]">{label}</label>
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          style={valid ? { backgroundColor: value, boxShadow: `0 0 18px -6px ${value}` } : undefined}
          className={cn(
            'relative h-11 w-14 shrink-0 overflow-hidden rounded-md border transition-all',
            valid ? 'border-[var(--border-strong)]' : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
          )}
        >
          <input
            type="color"
            value={valid ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="#1648A0"
          maxLength={7}
          className="h-11 border-[var(--border-default)] bg-[var(--bg-surface)] font-mono uppercase tracking-wide text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:border-[var(--border-focus)] focus-visible:ring-1 focus-visible:ring-[var(--accent-muted)]"
        />
      </div>
    </div>
  )
}
