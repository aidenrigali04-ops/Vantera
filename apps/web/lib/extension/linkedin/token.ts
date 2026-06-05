import crypto from 'crypto'

const TOKEN_PREFIX = 'vnt_li_'

function tokenPepper(): string {
  const pepper =
    process.env.LINKEDIN_EXTENSION_TOKEN_PEPPER?.trim() ||
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    'dev-linkedin-extension-pepper'
  return pepper
}

export function generateLinkedInExtensionToken(): { token: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(24).toString('base64url')
  const token = `${TOKEN_PREFIX}${raw}`
  const prefix = token.slice(0, 12)
  const hash = hashLinkedInExtensionToken(token)
  return { token, prefix, hash }
}

export function hashLinkedInExtensionToken(token: string): string {
  return crypto.createHash('sha256').update(`${tokenPepper()}:${token}`).digest('hex')
}

export function isLinkedInExtensionTokenFormat(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) && token.length > TOKEN_PREFIX.length + 16
}
