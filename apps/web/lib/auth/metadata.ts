import type { Metadata } from 'next'

const DEFAULT_DESCRIPTION =
  'Vantera centralizes revenue, operations, and client delivery in one structured workspace.'

export const authPageMetadata = {
  signup: {
    title: 'Create your workspace — Vantera',
    description: DEFAULT_DESCRIPTION,
  },
  login: {
    title: 'Sign in — Vantera',
    description: DEFAULT_DESCRIPTION,
  },
  forgotPassword: {
    title: 'Reset your password — Vantera',
    description: DEFAULT_DESCRIPTION,
  },
  resetPassword: {
    title: 'Choose a new password — Vantera',
    description: DEFAULT_DESCRIPTION,
  },
  completeSignup: {
    title: 'Finish setup — Vantera',
    description: DEFAULT_DESCRIPTION,
  },
} satisfies Record<string, Metadata>

export function portalLoginMetadata(businessName?: string | null): Metadata {
  const name = businessName?.trim()
  return {
    title: name ? `Sign in — ${name}` : 'Client portal sign in',
    description: name
      ? `Sign in to the ${name} client portal.`
      : 'Sign in to view your projects, invoices, and updates.',
  }
}

export function portalHomeMetadata(businessName?: string | null): Metadata {
  const name = businessName?.trim()
  return {
    title: name ? `${name} — Client portal` : 'Client portal',
    description: name
      ? `Your ${name} client workspace for projects, documents, and billing.`
      : 'Your client workspace for projects, documents, and billing.',
  }
}
