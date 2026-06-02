import { redirect } from 'next/navigation'

/** Legacy path — Prospect Scout lives under /agents/scout, not Aspire. */
export default function LegacyProspectScoutRedirect() {
  redirect('/admin/outreach/agents/scout')
}
