import type { Metadata } from 'next'

const DEFAULT_DESCRIPTION =
  'Ventaro centralizes revenue, operations, and client delivery in one structured workspace.'

export const authPageMetadata = {
  signup: {
    title: 'Create your workspace — Ventaro',
    description: DEFAULT_DESCRIPTION,
  },
  login: {
    title: 'Sign in — Ventaro',
    description: DEFAULT_DESCRIPTION,
  },
  forgotPassword: {
    title: 'Reset your password — Ventaro',
    description: DEFAULT_DESCRIPTION,
  },
  resetPassword: {
    title: 'Choose a new password — Ventaro',
    description: DEFAULT_DESCRIPTION,
  },
  completeSignup: {
    title: 'Finish setup — Ventaro',
    description: DEFAULT_DESCRIPTION,
  },
} satisfies Record<string, Metadata>

export function portalLoginMetadata(businessName?: string | null): Metadata {
  const name = businessName?.trim()
  return {
    title: name ? `Client portal — ${name}` : 'Client portal — Ventaro',
    description: 'Sign in to view your projects, invoices, and updates.',
  }
}
