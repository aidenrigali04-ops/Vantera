import { AUTH_SIGNUP_PATH } from '@/lib/auth/routes'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Legacy signup URL — canonical entry is `/`. */
export default function SignupPage() {
  redirect(AUTH_SIGNUP_PATH)
}
