'use client'

import { SignupForm } from '@/components/shared/signup-form'
import { signupAction } from '@/lib/auth/actions'
import { invokeAuthAction } from '@/lib/auth/invoke-action'

export function SignupClient() {
  return (
    <SignupForm
      onSubmit={(values) =>
        invokeAuthAction(() => signupAction(values), '/admin/dashboard')
      }
    />
  )
}
