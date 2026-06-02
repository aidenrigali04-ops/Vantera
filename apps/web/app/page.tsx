import { AuthEntryPage } from '@/components/auth/auth-entry-page'
import { authPageMetadata } from '@/lib/auth/metadata'

export const dynamic = 'force-dynamic'
export const metadata = authPageMetadata.signup

export default function HomePage() {
  return <AuthEntryPage />
}
