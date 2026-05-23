import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
})

const serverEnvSchema = z.object({
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
  TRIGGER_SECRET_KEY: z.string().min(1),
  TRIGGER_API_URL: z.string().url(),
})

type PublicEnv = z.infer<typeof publicEnvSchema>
type ServerEnv = z.infer<typeof serverEnvSchema>
export type Env = PublicEnv & ServerEnv

const PUBLIC_ENV_KEYS = new Set<string>(Object.keys(publicEnvSchema.shape))

function formatZodError(label: string, error: z.ZodError): string {
  const messages = error.issues.map((issue) => {
    const key = issue.path.join('.')
    return `  - ${key}: ${issue.message}`
  })

  return [label, ...messages].join('\n')
}

let cachedPublicEnv: PublicEnv | undefined
let cachedServerEnv: ServerEnv | undefined

function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv
  }

  const parsed = publicEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new Error(
      [
        formatZodError('Missing or invalid public environment variables:', parsed.error),
        '',
        'Set NEXT_PUBLIC_* vars in Vercel → Project → Settings → Environment Variables.',
        'Enable Production and Preview, then redeploy without cache.',
      ].join('\n'),
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv
  }

  const parsed = serverEnvSchema.safeParse({
    ...process.env,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY ?? process.env.TRIGGER_API_KEY,
  })

  if (!parsed.success) {
    throw new Error(
      [
        formatZodError('Missing or invalid server environment variables:', parsed.error),
        '',
        'Set server secrets in Vercel → Project → Settings → Environment Variables.',
        'Common fixes:',
        '  - DATABASE_URL: postgresql:// with URL-encoded password',
        '  - TRIGGER_API_URL: must start with https://',
        '  - Remove surrounding quotes from values',
      ].join('\n'),
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
