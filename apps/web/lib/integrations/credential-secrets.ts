import { decryptSecret, encryptSecret } from '@/lib/crypto'

export function encryptCredentialValue(value: string | null | undefined): string | null {
  if (!value) return null
  return encryptSecret(value)
}

export function decryptCredentialValue(value: string | null | undefined): string | null {
  return decryptSecret(value)
}
