import type { SessionPayload } from '@/lib/auth/types'
import { jwtVerify, SignJWT } from 'jose'
import { SESSION_MAX_AGE_SECONDS } from '@/lib/auth/constants'

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured')
  }

  return new TextEncoder().encode(secret)
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as SessionPayload
  } catch {
    return null
  }
}
