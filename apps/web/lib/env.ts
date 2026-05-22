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
  throw new Error(missing.map((key) => `Missing: ${key}`).join('\n'))
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
  const invalid = parsed.error.issues
    .map((issue) => issue.path[0])
    .filter((key): key is string => typeof key === 'string')

  throw new Error([...new Set(invalid)].map((key) => `Missing: ${key}`).join('\n'))
}

export const env = { ...parsed.data }

export type Env = typeof env
