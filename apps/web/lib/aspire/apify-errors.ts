/** Detect Apify auth failures from HTTP bodies (JSON or plain text). */
export function isApifyAuthError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('user-or-token-not-found') ||
    lower.includes('authentication token is not valid') ||
    lower.includes('token is not valid') ||
    lower.includes('invalid api token') ||
    (lower.includes('unauthorized') && lower.includes('token'))
  )
}

/** Extract a human-readable message from Apify error payloads. */
export function parseApifyErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed) return fallback
    try {
      return parseApifyErrorMessage(JSON.parse(trimmed), fallback)
    } catch {
      return trimmed.slice(0, 300)
    }
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const nested = record.error
    if (nested && typeof nested === 'object') {
      const errObj = nested as Record<string, unknown>
      if (typeof errObj.message === 'string' && errObj.message.trim()) {
        return errObj.message.trim()
      }
    }
    if (typeof record.error === 'string') return record.error
    if (typeof record.message === 'string') return record.message
  }

  return fallback
}

/** User-safe copy — never show raw provider JSON in the UI. */
export function toUserFacingProspectSearchError(message: string): string {
  if (isApifyAuthError(message)) {
    return 'Apify token is invalid or expired. Update APIFY_API_TOKEN in Vercel and redeploy.'
  }
  if (/APIFY_API_TOKEN is not set/i.test(message)) {
    return 'Apify is not configured. Set APIFY_API_TOKEN in Vercel → Environment Variables (Production), then redeploy.'
  }
  if (/returned no leads/i.test(message)) {
    return 'No live matches for this search — showing sample leads so you can keep exploring.'
  }
  if (/none could be mapped/i.test(message)) {
    return 'Apify returned data but leads could not be parsed. Check APIFY_LEADS_ACTOR_ID matches your actor.'
  }
  return 'Live search is temporarily unavailable — sample leads are shown so you can continue.'
}

export type AspireSearchMetaNotice = {
  tone: 'warning' | 'info'
  message: string
}

/** Map search API meta to accurate UI copy (stub ≠ always "not configured"). */
export function getAspireSearchNotice(meta?: {
  source?: 'apify' | 'stub' | 'demo'
  providerConfigured?: boolean
  providerError?: string
} | null): AspireSearchMetaNotice | null {
  if (!meta || meta.source === 'apify') return null

  if (meta.providerConfigured === false) {
    return {
      tone: 'warning',
      message: toUserFacingProspectSearchError(
        meta.providerError ?? 'APIFY_API_TOKEN is not set',
      ),
    }
  }

  if (meta.providerError) {
    return {
      tone: 'info',
      message: toUserFacingProspectSearchError(meta.providerError),
    }
  }

  return {
    tone: 'info',
    message: 'Showing sample leads for this search.',
  }
}
