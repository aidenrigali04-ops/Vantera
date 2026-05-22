import { z } from 'zod'

const requiredEnvKeys = [
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TRIGGER_API_KEY',
  'TRIGGER_API_URL',
  'NEXT_PUBLIC_APP_DOMAIN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const

const missing = requiredEnvKeys.filter((key) => {
  const value = process.env[key]
  return value === undefined || value === ''
})

if (missing.length > 0) {
  throw new Error(
    [
      'Missing required environment variables:',
      ...missing.map((key) => `  - ${key}`),
      '',
      'Set these in Vercel → Project → Settings → Environment Variables.',
      'Enable Production (and Preview). Redeploy after saving.',
    ].join('\n'),
  )
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  TRIGGER_API_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => {
    const key = issue.path.join('.')
    return `  - ${key}: ${issue.message}`
  })

  throw new Error(
    [
      'Invalid environment variables (set but failed validation):',
      ...messages,
      '',
      'Common fixes:',
      '  - DATABASE_URL: use postgresql:// with URL-encoded password',
      '  - TRIGGER_API_URL: must start with https://',
      '  - NEXT_PUBLIC_APP_URL: must start with https:// in production',
      '  - Remove surrounding quotes from values in Vercel',
    ].join('\n'),
  )
}

export const env = { ...parsed.data }

export type Env = typeof env
