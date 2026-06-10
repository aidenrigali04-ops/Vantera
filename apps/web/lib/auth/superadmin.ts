/**
 * Super-admin gate for internal/owner-only surfaces (e.g. the optimization
 * dashboard). Access is bound to the already-authenticated session email —
 * NOT a separate hardcoded password. The allowlist is overridable via the
 * SUPERADMIN_EMAILS env (comma-separated); it defaults to the platform owner.
 *
 * Why no second password: a credential in source lands in git history forever,
 * is unrotatable without a deploy, and is exactly the kind of plaintext-secret
 * finding the security audit flags. The owner already proves identity at login.
 */

const DEFAULT_SUPERADMINS = ['aiden@vanterasystem.com']

function allowlist(): string[] {
  const fromEnv = process.env.SUPERADMIN_EMAILS
  const raw = fromEnv && fromEnv.trim().length > 0 ? fromEnv : DEFAULT_SUPERADMINS.join(',')
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return allowlist().includes(email.trim().toLowerCase())
}
