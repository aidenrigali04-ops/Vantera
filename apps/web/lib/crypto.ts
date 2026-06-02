import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'v1'

function getEncryptionKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (32 bytes).')
  }
  return Buffer.from(raw, 'hex')
}

export function isCredentialEncryptionEnabled(): boolean {
  return Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY?.trim())
}

/** Encrypt a credential token for storage in integration_credentials. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY is required in production.')
    }
    return plaintext
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [PREFIX, iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  )
}

/** Decrypt a stored credential; returns legacy plaintext values unchanged. */
export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  if (!ciphertext.startsWith(`${PREFIX}:`)) {
    return ciphertext
  }

  const key = getEncryptionKey()
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is required to decrypt stored credentials.')
  }

  const parts = ciphertext.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return ciphertext
  }

  const [, ivB64, authTagB64, dataB64] = parts
  const iv = Buffer.from(ivB64!, 'base64')
  const authTag = Buffer.from(authTagB64!, 'base64')
  const encrypted = Buffer.from(dataB64!, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
