import 'server-only'

import { sanitizeEnvValue } from '@/lib/env'

const DEFAULT_LEADS_ACTOR_ID = 'code_crafter~leads-finder'

/** Env keys checked in order — supports common misnamed Vercel vars. */
const APIFY_TOKEN_ENV_KEYS = ['APIFY_API_TOKEN', 'APIFY_TOKEN', 'APIFY_API_KEY'] as const

const APIFY_ACTOR_ENV_KEYS = ['APIFY_LEADS_ACTOR_ID', 'APIFY_ACTOR_ID'] as const

function readEnv(key: string): string {
  const raw = process.env[key]
  if (typeof raw !== 'string') return ''
  return sanitizeEnvValue(raw)
}

/** Resolve Apify personal API token from runtime env (Vercel / Trigger / local). */
export function resolveApifyApiToken(): string {
  for (const key of APIFY_TOKEN_ENV_KEYS) {
    const value = readEnv(key)
    if (value) return value
  }
  return ''
}

/** Normalize actor id to Apify API format (`username~actor-name`). */
export function normalizeApifyActorId(raw: string): string {
  const trimmed = sanitizeEnvValue(raw)
  if (!trimmed) return DEFAULT_LEADS_ACTOR_ID
  return trimmed.replace(/\//g, '~')
}

export function resolveApifyActorId(): string {
  for (const key of APIFY_ACTOR_ENV_KEYS) {
    const value = readEnv(key)
    if (value) return normalizeApifyActorId(value)
  }
  return DEFAULT_LEADS_ACTOR_ID
}

export function isApifyConfigured(): boolean {
  return resolveApifyApiToken().length > 0
}

/** Safe server log when token is missing (never logs secret values). */
export function logApifyConfigDiagnostics(context: string): void {
  const presence = Object.fromEntries(
    APIFY_TOKEN_ENV_KEYS.map((key) => [key, Boolean(readEnv(key))]),
  )
  console.warn(`[${context}] Apify token not found`, presence)
}
