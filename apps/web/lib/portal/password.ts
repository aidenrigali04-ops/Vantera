import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

export async function hashPortalPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPortalPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}
