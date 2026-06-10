/** Paths where main content supplies its own horizontal padding (wide tables, agents). */
export function isAdminFullBleedPath(pathname: string): boolean {
  const isSdrSetupWizard = pathname.startsWith('/admin/outreach/agents/setup')
  return pathname.startsWith('/admin/outreach/agents') && !isSdrSetupWizard
}
