import { BrandingProvider } from '@/lib/branding/context'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

export default function PortalLayout({ children }: { children: ReactNode }) {
  const branding = getBrandingFromHeaders(headers())

  return <BrandingProvider branding={branding}>{children}</BrandingProvider>
}
