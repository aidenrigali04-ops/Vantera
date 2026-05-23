import { AuthLayout } from '@/components/shared/auth-layout'
import { CompleteSignupClient } from './complete-signup-client'

export const dynamic = 'force-dynamic'

type Search = {
  email?: string
  name?: string
}

export default function CompleteSignupPage({ searchParams }: { searchParams: Search }) {
  return (
    <AuthLayout>
      <CompleteSignupClient
        prefilledEmail={searchParams.email ?? ''}
        prefilledName={searchParams.name ?? ''}
      />
    </AuthLayout>
  )
}
