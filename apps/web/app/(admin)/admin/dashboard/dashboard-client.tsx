'use client'

import { useBranding } from '@/lib/branding/context'
import { Button } from '@/components/ui/button'
import { adminLogoutAction } from '@/lib/auth/actions'

type DashboardClientProps = {
  email: string
  role: string
}

export function DashboardClient({ email, role }: DashboardClientProps) {
  const branding = useBranding()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{branding.businessName} Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email} ({role})
            </p>
          </div>
          <form action={adminLogoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
