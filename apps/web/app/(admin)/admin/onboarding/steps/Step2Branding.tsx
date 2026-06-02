'use client'

import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import imageCompression from 'browser-image-compression'
import { motion } from 'framer-motion'
import { ImageIcon, Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { updateBranding } from '../actions'
import {
  FieldGroup,
  StepError,
  StepHeader,
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
const DOMAIN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

type Props = {
  accountId: string
  businessName: string
  initialLogoUrl: string | null
  initialPrimary: string
  initialSecondary: string
  initialPortalDomain: string
  onComplete: (data: {
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    portalDomain: string
  }) => void
}

export function Step2Branding({
  accountId,
  businessName,
  initialLogoUrl,
  initialPrimary,
  initialSecondary,
  initialPortalDomain,
  onComplete,
}: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoUploading, setLogoUploading] = useState(false)
  const [primary, setPrimary] = useState(initialPrimary)
  const [secondary, setSecondary] = useState(initialSecondary)
  const [portalDomain, setPortalDomain] = useState(initialPortalDomain)
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

    if (portalDomain && !DOMAIN.test(portalDomain)) {
      setError('Portal domain looks invalid — leave blank to skip')
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
          portalDomain: portalDomain || undefined,
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
        portalDomain,
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
  }, [accountId, logoUrl, onComplete, portalDomain, primary, secondary])

  useRegisterOnboardingStep({
    canAdvance: HEX.test(primary) && HEX.test(secondary),
    isSubmitting: saving || logoUploading,
    submit,
  })

  const previewDomain = portalDomain || 'portal.yourbusiness.com'

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-6">
      <StepHeader
        title="Make it yours"
        subtitle="Upload a logo, pick your brand colors, and reserve your client portal domain. Everything here is editable later from settings."
      />

      <FieldGroup label="Logo">
        <div
          {...getRootProps()}
          className={cn(
            'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-white/[0.02] p-10 text-center text-sm transition-all duration-200 hover:scale-[1.005]',
            isDragActive
              ? 'border-white/40 bg-white/[0.06]'
              : 'border-white/[0.10] hover:border-white/[0.25] hover:bg-white/[0.035]',
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
            <p className="text-sm font-medium text-white/90">
              {logoUploading
                ? 'Uploading…'
                : logoUrl
                  ? 'Drag a new file or click to replace'
                  : 'Drag your logo here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-white/45">PNG, JPG, WebP, or SVG · up to 2MB</p>
          </div>
        </div>
      </FieldGroup>

      <motion.section variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorField label="Primary color" value={primary} onChange={setPrimary} />
        <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
      </motion.section>

      <FieldGroup
        label="Portal domain"
        description={
          'Point your subdomain CNAME to portals.vantera.app. Setup instructions are emailed after onboarding.'
        }
      >
        <Input
          id="portal-domain"
          type="text"
          placeholder="portal.yourbusiness.com"
          value={portalDomain}
          onChange={(e) => setPortalDomain(e.target.value.trim())}
          className="h-11 border-white/[0.08] bg-white/[0.02] text-sm text-white placeholder:text-white/30 focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/10"
        />
      </FieldGroup>

      <FieldGroup label="Portal preview" description="A peek at how your portal will look to clients.">
        <motion.div
          variants={fadeUp}
          className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015]"
        >
          <div
            style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}
            className="flex items-center justify-between px-4 py-3 text-white"
          >
            <div className="flex items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-6 w-auto max-w-[100px] object-contain" />
              ) : (
                <span className="text-sm font-semibold">{businessName || 'Your Business'}</span>
              )}
            </div>
            <span className="text-xs opacity-80">{previewDomain}</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-white/30" aria-hidden />
              <div className="h-2 w-3/4 rounded bg-white/10" />
            </div>
            <div className="h-2 w-1/2 rounded bg-white/[0.06]" />
            <div className="mt-3 flex gap-2">
              <span
                style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm"
              >
                Primary
              </span>
              <span
                style={{ background: `linear-gradient(135deg, ${secondary}, ${secondary}cc)` }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm"
              >
                Secondary
              </span>
            </div>
          </div>
        </motion.div>
      </FieldGroup>

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
      <label className="text-sm font-semibold text-white">{label}</label>
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          style={valid ? { backgroundColor: value, boxShadow: `0 0 18px -6px ${value}` } : undefined}
          className={cn(
            'relative h-11 w-14 shrink-0 overflow-hidden rounded-md border transition-all',
            valid ? 'border-white/[0.15]' : 'border-white/[0.08] bg-white/[0.02]',
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
          className="h-11 border-white/[0.08] bg-white/[0.02] font-mono uppercase tracking-wide text-white placeholder:text-white/30 focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/10"
        />
      </div>
    </div>
  )
}
