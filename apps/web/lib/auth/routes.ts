/**
 * Post-auth destinations for Vantera.
 * New owners complete setup on the dedicated onboarding wizard before the dashboard.
 */
export const AUTH_ONBOARDING_PATH = '/admin/onboarding'
export const AUTH_DASHBOARD_PATH = '/admin/dashboard'

export const AUTH_SIGNUP_PATH = '/'
export const AUTH_LOGIN_PATH = '/auth/login'
export const AUTH_ENTRY_PATH = '/'
/** Canonical login entry on the unified auth page. */
export const AUTH_LOGIN_ENTRY = `${AUTH_ENTRY_PATH}?mode=login`
export const AUTH_CALLBACK_PATH = '/auth/callback'

export type AuthIntent = 'signup' | 'login'
