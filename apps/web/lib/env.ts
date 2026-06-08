import { z } from 'zod'

import { PUBLIC_ENV_DEFAULTS } from '@/config/public-env-defaults'

// Only the variables actually required to render an auth'd page are mandatory
// here. Everything else (Anthropic, Twilio, Resend, Stripe, Trigger, etc.) is
// optional at the schema level and validated at its real point of use. This
// way a single missing API key can never crash the whole app — it only fails
// the one feature that needs it, and only when that feature is exercised.

const postgresUrlSchema = z
  .string()
  .min(1, 'Required')
  .refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'Must start with postgres:// or postgresql://',
  )

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
})

const serverEnvSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema.optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_PHONE_NUMBER: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(''),
  OUTREACH_INBOUND_DOMAIN: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  /** Stripe Price ID for Vantera Team (subscription checkout). */
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional().default(''),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z.string().optional().default(''),
  /** Stripe Price ID for an additional team seat ($25/mo recurring). */
  STRIPE_PRICE_SEAT_MONTHLY: z.string().optional().default(''),
  TRIGGER_SECRET_KEY: z.string().optional().default(''),
  TRIGGER_API_URL: z.string().optional().default('https://api.trigger.dev'),
  CRON_SECRET: z.string().optional().default(''),
  /** Explorium (Vibe Prospecting) API key — primary lead source. */
  EXPLORIUM_API_KEY: z.string().optional().default(''),
  EXPLORIUM_API_BASE_URL: z.string().optional().default('https://api.explorium.ai/v1'),
})

type PublicEnv = z.infer<typeof publicEnvSchema>
type ServerEnv = z.infer<typeof serverEnvSchema>
export type Env = PublicEnv & ServerEnv

/** Safe browser defaults — override via Vercel env or local .env (see config/public-env.defaults). */
const PUBLIC_ENV_DEFAULTS_MAP: Record<keyof PublicEnv, string> = {
  ...PUBLIC_ENV_DEFAULTS,
}

const PUBLIC_ENV_KEYS = new Set<string>(Object.keys(publicEnvSchema.shape))

/**
 * Next.js only inlines NEXT_PUBLIC_* when accessed statically (process.env.FOO).
 * Dynamic reads like Object.entries(process.env) are empty in client bundles.
 */
function readPublicEnvFromProcess(): Partial<Record<keyof PublicEnv, string | undefined>> {
  return {
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  }
}

/** Trim whitespace and strip surrounding quotes from .env values. */
export function sanitizeEnvValue(value: string): string {
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function buildEnvInput(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...PUBLIC_ENV_DEFAULTS_MAP }

  for (const [key, value] of Object.entries(readPublicEnvFromProcess())) {
    if (typeof value === 'string') {
      const sanitized = sanitizeEnvValue(value)
      if (sanitized) {
        out[key] = sanitized
      }
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (PUBLIC_ENV_KEYS.has(key)) continue
    if (typeof value === 'string') {
      const sanitized = sanitizeEnvValue(value)
      if (sanitized) {
        out[key] = sanitized
      }
    }
  }

  out.TRIGGER_SECRET_KEY = out.TRIGGER_SECRET_KEY ?? out.TRIGGER_API_KEY
  out.SUPABASE_SERVICE_ROLE_KEY = out.SUPABASE_SERVICE_ROLE_KEY ?? out.SUPABASE_SERVICE_KEY
  out.SUPABASE_JWT_SECRET = out.SUPABASE_JWT_SECRET ?? out.JWT_SECRET
  out.DATABASE_URL = out.DATABASE_URL ?? out.POSTGRES_URL ?? out.POSTGRES_PRISMA_URL

  return out
}

function formatZodError(label: string, error: z.ZodError): string {
  const messages = error.issues.map((issue) => {
    const key = issue.path.join('.')
    return `  - ${key}: ${issue.message}`
  })

  return [label, ...messages].join('\n')
}

function envHelpFooter(): string {
  return [
    '',
    'Local development:',
    '  - Run from the Vantera repo root: pnpm larry:run',
    '  - Ensure `.env` exists at the repo root (or apps/web/.env)',
    '  - Larry CLI loads .env via dotenv-cli before starting',
    '',
    'Vercel:',
    '  - Set server secrets in Project → Settings → Environment Variables',
    '  - NEXT_PUBLIC_* defaults live in apps/web/config/public-env.defaults',
    'Trigger.dev (Larry scheduled runs):',
    '  - Vars must exist in Trigger.dev cloud — redeploy: pnpm trigger:deploy',
    '  - Deploy syncs from repo `.env` via trigger.config.ts syncEnvVars',
    '  - Or set manually in Trigger.dev → Project → Environment Variables',
    'Common fixes:',
    '  - DATABASE_URL must start with postgres:// or postgresql://',
    '  - URL-encode special characters in passwords (@, #, etc.)',
    '  - Remove surrounding quotes and trailing whitespace from values',
  ].join('\n')
}

let cachedPublicEnv: PublicEnv | undefined
let cachedServerEnv: ServerEnv | undefined

function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv
  }

  const parsed = publicEnvSchema.safeParse(buildEnvInput())

  if (!parsed.success) {
    throw new Error(
      [formatZodError('Missing or invalid public environment variables:', parsed.error), envHelpFooter()].join(
        '\n',
      ),
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv
  }

  const parsed = serverEnvSchema.safeParse(buildEnvInput())

  if (!parsed.success) {
    throw new Error(
      [formatZodError('Missing or invalid server environment variables:', parsed.error), envHelpFooter()].join(
        '\n',
      ),
    )
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}

export const env = new Proxy({} as Env, {
  get(_target, prop, receiver) {
    if (typeof prop !== 'string') {
      return Reflect.get(_target, prop, receiver)
    }

    if (PUBLIC_ENV_KEYS.has(prop)) {
      return getPublicEnv()[prop as keyof PublicEnv]
    }

    return getServerEnv()[prop as keyof ServerEnv]
  },
})

/**
 * Use this at the point of consumption when a feature needs a specific secret
 * that's now optional at the schema level (e.g. Stripe, Resend, Twilio,
 * Anthropic). Throws a clear, feature-scoped error instead of letting the
 * underlying SDK throw a cryptic one.
 */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `${String(key)} is not configured. Set it in Vercel → Project → Settings → Environment Variables, then redeploy.`,
    )
  }
  return value as NonNullable<Env[K]>
}
