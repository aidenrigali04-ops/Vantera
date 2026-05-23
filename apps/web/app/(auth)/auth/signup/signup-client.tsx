'use client'

import { SignupForm } from '@/components/shared/signup-form'
import { signupAction } from '@/lib/auth/actions'

export function SignupClient() {
  return (
    <SignupForm
      onSubmit={async (values) => {
        const result = await signupAction(values)

        if (!result.success) {
          return { success: false, error: result.error }
        }

        return { success: true, redirectTo: result.data.redirectTo }
      }}
    />
  )
}
