import postgres from 'postgres'
import { getDebugTestConfig, normalizeAppBaseUrl } from './config'

let adminSql: ReturnType<typeof postgres> | undefined

export function getAdminSql() {
  if (!adminSql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required for debug checks')
    adminSql = postgres(url, { prepare: false, max: 2 })
  }
  return adminSql
}

export async function closeAdminSql(): Promise<void> {
  if (adminSql) {
    await adminSql.end()
    adminSql = undefined
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Candidate app base URLs in priority order for Larry HTTP probes. */
export function getAppBaseUrlCandidates(): string[] {
  const cfg = getDebugTestConfig()
  const seen = new Set<string>()
  const ordered: string[] = []

  const add = (raw?: string) => {
    const normalized = normalizeAppBaseUrl(raw)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    ordered.push(normalized)
  }

  add(cfg.internalApiBaseUrl)
  add(process.env.NEXT_PUBLIC_APP_URL)
  if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_BRANCH_URL) add(`https://${process.env.VERCEL_BRANCH_URL}`)
  add('http://127.0.0.1:3000')
  add('http://localhost:3000')
  add('http://lvh.me:3000')

  return ordered
}

export interface AppProbeResult {
  baseUrl: string
  response: Response
}

export interface AppProbeDetailedResult {
  ok: boolean
  baseUrl?: string
  candidates: string[]
  attempts: Array<{ baseUrl: string; error: string }>
}

async function probeSingleBaseUrl(
  baseUrl: string,
  timeoutMs: number,
): Promise<AppProbeResult> {
  const response = await fetchWithTimeout(`${baseUrl}/api/health`, {}, timeoutMs)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const body = (await response.clone().json().catch(() => ({}))) as { ok?: boolean }
  if (body.ok !== true) {
    throw new Error('Health body missing ok:true')
  }

  return { baseUrl, response }
}

/** Probe each candidate sequentially with retries — reliable on cold starts. */
export async function probeAppHealthDetailed(options?: {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}): Promise<AppProbeDetailedResult> {
  const timeoutMs = options?.timeoutMs ?? 8_000
  const retries = options?.retries ?? 2
  const retryDelayMs = options?.retryDelayMs ?? 750
  const candidates = getAppBaseUrlCandidates()
  const attempts: Array<{ baseUrl: string; error: string }> = []

  for (const baseUrl of candidates) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const probe = await probeSingleBaseUrl(baseUrl, timeoutMs)
        return { ok: true, baseUrl: probe.baseUrl, candidates, attempts }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'probe failed'
        attempts.push({ baseUrl, error: message })
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        }
      }
    }
  }

  return { ok: false, candidates, attempts }
}

/** Try each candidate base URL until /api/health responds. */
export async function probeAppHealth(timeoutMs = 8_000): Promise<AppProbeResult | null> {
  const detailed = await probeAppHealthDetailed({ timeoutMs, retries: 1 })
  if (!detailed.ok || !detailed.baseUrl) return null

  try {
    return await probeSingleBaseUrl(detailed.baseUrl, timeoutMs)
  } catch {
    return null
  }
}

/** Fetch a path on the first reachable app base URL. */
export async function fetchAppPath(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<{ baseUrl: string; response: Response }> {
  const probe = await probeAppHealth(timeoutMs)
  if (!probe) {
    throw new Error(
      `App unreachable at ${getAppBaseUrlCandidates().join(', ')} — start dev server or set INTERNAL_API_BASE_URL`,
    )
  }

  const url = `${probe.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetchWithTimeout(url, init, timeoutMs)
  return { baseUrl: probe.baseUrl, response }
}
