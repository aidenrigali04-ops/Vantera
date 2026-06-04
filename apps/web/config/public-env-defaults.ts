/** Production hostname when NEXT_PUBLIC_* is unset (custom domain on Vercel). */
export const PRODUCTION_APP_DOMAIN = 'vanterasystem.dev'

/** Committed NEXT_PUBLIC fallbacks — override via Vercel env or local .env. */
export const PUBLIC_ENV_DEFAULTS = {
  NEXT_PUBLIC_APP_DOMAIN: PRODUCTION_APP_DOMAIN,
  NEXT_PUBLIC_APP_URL: `https://${PRODUCTION_APP_DOMAIN}`,
  NEXT_PUBLIC_SUPABASE_URL: 'https://kchaqjyvubbrrjpisxpy.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaGFxanl2dWJicnJqcGlzeHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODAzMjEsImV4cCI6MjA5NTA1NjMyMX0.WMwX86WCr7hl6rOamuJRvrxCwz2YfBUK3IgwMdr9jSQ',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
} as const

export type PublicEnvDefaultKey = keyof typeof PUBLIC_ENV_DEFAULTS
