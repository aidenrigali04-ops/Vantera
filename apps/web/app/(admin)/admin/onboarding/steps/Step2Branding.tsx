'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import imageCompression from 'browser-image-compression'
import { Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { updateBranding } from '../actions'

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

  async function handleContinue() {
    if (!HEX.test(primary)) {
      setError('Primary color must be a 6-digit hex')
      return
    }

    if (!HEX.test(secondary)) {
      setError('Secondary color must be a 6-digit hex')
      return
    }

    if (portalDomain && !DOMAIN.test(portalDomain)) {
      setError('Portal domain looks invalid — leave blank to skip')
      return
    }

    setError(null)
    setSaving(true)

    const result = await updateBranding(accountId, {
      logoUrl: logoUrl,
      primaryColor: primary,
      secondaryColor: secondary,
      portalDomain: portalDomain || undefined,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onComplete({
      logoUrl,
      primaryColor: primary,
      secondaryColor: secondary,
      portalDomain,
    })
  }

  const previewDomain = portalDomain || 'portal.yourbusiness.com'

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Make it yours</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Upload a logo, pick your brand colors, and reserve your client portal domain. Everything
          here is editable later from settings.
        </p>
      </div>

      <section className="space-y-3">
        <label className="text-sm font-semibold">Logo</label>
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm transition-colors',
            isDragActive ? 'border-foreground bg-muted/60' : 'hover:border-foreground/40 hover:bg-muted/40',
          )}
        >
          <input {...getInputProps()} />
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo preview" className="h-14 w-auto max-w-[220px] object-contain" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <p className="text-muted-foreground">
            {logoUploading
              ? 'Uploading…'
              : logoUrl
                ? 'Drag a new file or click to replace'
                : 'Drag your logo here, or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or SVG · up to 2MB</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorField label="Primary color" value={primary} onChange={setPrimary} />
        <ColorField label="Secondary color" value={secondary} onChange={setSecondary} />
      </section>

      <section className="space-y-2">
        <label htmlFor="portal-domain" className="text-sm font-medium">
          Portal domain (optional)
        </label>
        <Input
          id="portal-domain"
          type="text"
          placeholder="portal.yourbusiness.com"
          value={portalDomain}
          onChange={(e) => setPortalDomain(e.target.value.trim())}
        />
        <p className="text-xs text-muted-foreground">
          Point your subdomain's CNAME record to: <span className="font-mono">portals.vantera.app</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Setup instructions will be sent to your email after onboarding.
        </p>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-semibold">Portal preview</p>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div
            style={{ backgroundColor: primary }}
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
          <div className="space-y-2 p-4">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="mt-4 flex gap-2">
              <span
                style={{ backgroundColor: primary }}
                className="rounded px-3 py-1 text-xs font-medium text-white"
              >
                Primary
              </span>
              <span
                style={{ backgroundColor: secondary }}
                className="rounded px-3 py-1 text-xs font-medium text-white"
              >
                Secondary
              </span>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleContinue}
          disabled={saving}
          style={{ backgroundColor: primary }}
          className="min-w-[140px]"
        >
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX.test(value)
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          style={valid ? { backgroundColor: value } : undefined}
          className={cn(
            'relative h-10 w-12 shrink-0 overflow-hidden rounded-md border border-input ring-1 ring-inset ring-black/[0.04] transition-colors',
            !valid && 'bg-background',
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
          className="font-mono uppercase tracking-wide"
        />
      </div>
    </div>
  )
}
