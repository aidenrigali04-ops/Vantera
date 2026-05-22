import { requirePortalSession } from '@/lib/auth/require-session'
import { portalLogoutAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export default async function PortalHomePage() {
  const session = await requirePortalSession()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Client Portal</h1>
            <p className="text-sm text-muted-foreground">Signed in as {session.email}</p>
          </div>
          <form action={portalLogoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
