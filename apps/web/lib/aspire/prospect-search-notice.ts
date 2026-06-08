/** User-safe copy — never show raw provider JSON in the UI. */
export function toUserFacingProspectSearchError(message: string): string {
  if (/EXPLORIUM_API_KEY is not set/i.test(message)) {
    return 'Explorium is not configured. Set EXPLORIUM_API_KEY in Vercel → Environment Variables (Production), then redeploy.'
  }
  if (/returned no (results|leads)/i.test(message)) {
    return 'No live matches for this search — showing sample leads so you can keep exploring.'
  }
  if (/timed out|timeout|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i.test(message)) {
    return 'Lead search timed out on the server. Try a narrower keyword — or upgrade Vercel plan for longer function runs.'
  }
  if (/usage.*limit|insufficient|credits|billing/i.test(message)) {
    return 'Explorium account limit reached. Check billing and access in your Explorium console.'
  }
  if (/invalid input|validation/i.test(message)) {
    return 'The search filters were rejected by the provider. Try a simpler keyword or company name.'
  }
  if (/Search fallback/i.test(message)) {
    return 'Live search did not finish in time. Try again with a specific company or keyword.'
  }
  const trimmed = message.trim()
  if (trimmed.length > 0 && trimmed.length <= 160) {
    return `Live search failed: ${trimmed}`
  }
  if (trimmed.length > 160) {
    return `Live search failed: ${trimmed.slice(0, 157)}…`
  }
  return 'Live search is temporarily unavailable — sample leads are shown so you can continue.'
}

export type AspireSearchMetaNotice = {
  tone: 'warning' | 'info'
  message: string
}

/** Map search API meta to accurate UI copy (stub ≠ always "not configured"). */
export function getAspireSearchNotice(meta?: {
  source?: 'apify' | 'stub' | 'demo' | 'explorium'
  providerConfigured?: boolean
  providerError?: string
} | null): AspireSearchMetaNotice | null {
  if (!meta || meta.source === 'explorium') return null

  if (meta.providerConfigured === false) {
    return {
      tone: 'warning',
      message: toUserFacingProspectSearchError(
        meta.providerError ?? 'EXPLORIUM_API_KEY is not set',
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
