import { AUTH_ENTRY_PATH } from '@/lib/auth/routes'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Legacy entry — signup lives at `/`. */
export default function AuthPage() {
  redirect(AUTH_ENTRY_PATH)
}
