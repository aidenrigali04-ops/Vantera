/**
 * Post-auth destinations for Ventaro.
 * Explore-first onboarding and the live workspace both render at the dashboard route.
 */
export const AUTH_ONBOARDING_PATH = '/admin/dashboard'
export const AUTH_DASHBOARD_PATH = '/admin/dashboard'

export const AUTH_SIGNUP_PATH = '/auth/signup'
export const AUTH_LOGIN_PATH = '/auth/login'
export const AUTH_ENTRY_PATH = '/auth'
/** Canonical login entry on the unified auth page. */
export const AUTH_LOGIN_ENTRY = `${AUTH_ENTRY_PATH}?mode=login`
export const AUTH_CALLBACK_PATH = '/auth/callback'

export type AuthIntent = 'signup' | 'login'
