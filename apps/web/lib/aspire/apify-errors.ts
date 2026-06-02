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
    return 'Lead discovery is temporarily using sample matches. Live search will activate once provider credentials are updated.'
  }
  if (/returned no leads/i.test(message)) {
    return 'No live matches yet — showing sample leads that fit your profile so you can continue.'
  }
  return 'Could not load live leads right now. Sample matches are shown so you can keep going.'
}
