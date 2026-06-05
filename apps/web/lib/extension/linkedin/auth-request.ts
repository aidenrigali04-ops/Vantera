import { resolveLinkedInExtensionSession, type LinkedInExtensionSession } from '@/lib/linkedin/accounts'

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

export async function requireExtensionSession(
  request: Request,
): Promise<LinkedInExtensionSession | null> {
  const token = readBearerToken(request)
  return resolveLinkedInExtensionSession(token)
}
