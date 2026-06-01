import { AUTH_LOGIN_PATH, AUTH_SIGNUP_PATH } from '@/lib/auth/routes'

export type AuthMode = 'signup' | 'login'

export function resolveAuthModeFromPath(pathname: string): AuthMode {
  if (pathname === AUTH_LOGIN_PATH || pathname.endsWith('/auth/login')) {
    return 'login'
  }
  return 'signup'
}

export function resolveAuthModeFromSearch(
  modeParam: string | null | undefined,
  pathname: string,
): AuthMode {
  if (modeParam === 'login') return 'login'
  if (modeParam === 'signup') return 'signup'
  return resolveAuthModeFromPath(pathname)
}
