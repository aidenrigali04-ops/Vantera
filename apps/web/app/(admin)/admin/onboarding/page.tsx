import { redirect } from 'next/navigation'

/** Legacy route — onboarding is explore-first on the dashboard. */
export default function OnboardingRedirectPage() {
  redirect('/admin/dashboard')
}
