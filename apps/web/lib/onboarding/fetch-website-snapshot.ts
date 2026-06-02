import 'server-only'

import {
  formatWebsiteSnapshotForPrompt,
  parseWebsiteSnapshotHtml,
  type WebsiteSnapshot,
} from '@/lib/onboarding/parse-website-snapshot'

export type { WebsiteSnapshot } from '@/lib/onboarding/parse-website-snapshot'
export { formatWebsiteSnapshotForPrompt, parseWebsiteSnapshotHtml } from '@/lib/onboarding/parse-website-snapshot'

const FETCH_TIMEOUT_MS = 5_000
const MAX_HTML_BYTES = 400_000

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

async function readLimitedResponseText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    return text.slice(0, maxBytes)
  }

  const chunks: Uint8Array[] = []
  let total = 0

  while (total < maxBytes) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    total += value.length
  }

  await reader.cancel().catch(() => undefined)

  const merged = new Uint8Array(Math.min(total, maxBytes))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= maxBytes) break
    const slice = chunk.slice(0, maxBytes - offset)
    merged.set(slice, offset)
    offset += slice.length
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

/** Fetch public homepage content for onboarding AI analysis. Returns null on any failure. */
export async function fetchWebsiteSnapshot(rawUrl: string): Promise<WebsiteSnapshot | null> {
  const url = normalizeWebsiteUrl(rawUrl)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'VanteraOnboarding/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }

    const html = await readLimitedResponseText(response, MAX_HTML_BYTES)
    if (!html.trim()) return null

    return parseWebsiteSnapshotHtml(url, html)
  } catch {
    return null
  }
}
