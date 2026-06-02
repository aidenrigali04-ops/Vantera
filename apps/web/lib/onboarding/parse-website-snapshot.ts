export type WebsiteSnapshot = {
  url: string
  hostname: string
  title: string | null
  description: string | null
  headings: string[]
  excerpt: string | null
}

const MAX_EXCERPT_CHARS = 2_500

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function readMetaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
        'i',
      ),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]?.trim()) {
        return decodeHtmlEntities(match[1].trim())
      }
    }
  }
  return null
}

function readTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) return null
  return decodeHtmlEntities(match[1].replace(/\s+/g, ' ').trim()) || null
}

function readHeadings(html: string): string[] {
  const headings: string[] = []
  const pattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let match: RegExpExecArray | null = pattern.exec(html)
  while (match && headings.length < 8) {
    const raw = match[1]
    if (!raw) {
      match = pattern.exec(html)
      continue
    }
    const text = decodeHtmlEntities(raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    if (text.length >= 3) headings.push(text)
    match = pattern.exec(html)
  }
  return headings
}

function readBodyExcerpt(html: string): string | null {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const bodyMatch = withoutScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const source = bodyMatch?.[1] ?? withoutScripts
  const text = decodeHtmlEntities(source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  if (!text) return null
  return text.slice(0, MAX_EXCERPT_CHARS)
}

/** Parse HTML into the fields we send to onboarding AI analysis. */
export function parseWebsiteSnapshotHtml(url: string, html: string): WebsiteSnapshot {
  const hostname = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()

  const description =
    readMetaContent(html, ['description', 'og:description', 'twitter:description']) ?? null

  return {
    url,
    hostname,
    title: readTitle(html),
    description,
    headings: readHeadings(html),
    excerpt: readBodyExcerpt(html),
  }
}

export function formatWebsiteSnapshotForPrompt(snapshot: WebsiteSnapshot): string {
  return [
    `URL: ${snapshot.url}`,
    snapshot.title ? `Title: ${snapshot.title}` : null,
    snapshot.description ? `Meta description: ${snapshot.description}` : null,
    snapshot.headings.length > 0 ? `Headings: ${snapshot.headings.join(' · ')}` : null,
    snapshot.excerpt ? `Page excerpt: ${snapshot.excerpt}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
