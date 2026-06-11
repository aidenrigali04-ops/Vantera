import { redirect } from 'next/navigation'

/** Legacy alias — dashboard and onboarding once linked here. */
export default function AgentsAliasPage() {
  redirect('/admin/outreach/agents')
}
