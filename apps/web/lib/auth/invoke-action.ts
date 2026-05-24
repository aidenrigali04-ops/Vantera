import type { ActionResult } from '@/lib/auth/types'

export type ClientActionResult = {
  success: boolean
  error?: string
  redirectTo?: string
}

export function isNextRedirectError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

/**
 * Wrap auth Server Actions that call redirect() on success.
 *
 * redirect() ends the action without returning a value, so the client RPC
 * resolves `undefined`. Without this guard, wrappers that read
 * `result.success` throw ("undefined is not a value; evaluating success")
 * even though signup/login actually succeeded and navigation is in flight.
 */
export async function invokeAuthAction<T extends { redirectTo?: string } | void>(
  fn: () => Promise<ActionResult<T> | void | undefined>,
  fallbackRedirect?: string,
): Promise<ClientActionResult> {
  try {
    const result = await fn()

    if (result == null) {
      return { success: true, redirectTo: fallbackRedirect }
    }

    if (!result.success) {
      return { success: false, error: result.error }
    }

    const redirectTo =
      result.data &&
      typeof result.data === 'object' &&
      'redirectTo' in result.data &&
      typeof (result.data as { redirectTo?: string }).redirectTo === 'string'
        ? (result.data as { redirectTo: string }).redirectTo
        : fallbackRedirect

    return { success: true, redirectTo }
  } catch (err) {
    if (isNextRedirectError(err)) throw err
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
    }
  }
}
