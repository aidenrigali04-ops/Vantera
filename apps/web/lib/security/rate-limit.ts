import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type LimitResult = { success: boolean; limit?: number; remaining?: number }

let general: Ratelimit | null | undefined
let auth: Ratelimit | null | undefined

function isConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getGeneralLimiter(): Ratelimit | null {
  if (general !== undefined) return general
  if (!isConfigured()) {
    general = null
    return general
  }
  general = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    analytics: true,
    prefix: 'vantera_rl',
  })
  return general
}

function getAuthLimiter(): Ratelimit | null {
  if (auth !== undefined) return auth
  if (!isConfigured()) {
    auth = null
    return auth
  }
  auth = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'vantera_auth_rl',
  })
  return auth
}

export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  )
}

export function shouldBypassRateLimit(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/cron/')
  )
}

export function isAuthRateLimitPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth') ||
    pathname.includes('/login') ||
    pathname.includes('/signup')
  )
}

export async function applyRateLimit(
  pathname: string,
  ip: string,
): Promise<LimitResult> {
  const limiter = isAuthRateLimitPath(pathname) ? getAuthLimiter() : getGeneralLimiter()
  if (!limiter) {
    return { success: true }
  }

  const result = await limiter.limit(ip)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
  }
}
