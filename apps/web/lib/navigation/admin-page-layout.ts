/** Paths where main content supplies its own horizontal padding (wide tables, agents, aspire). */
export function isAdminFullBleedPath(pathname: string): boolean {
  const isSdrSetupWizard = pathname.startsWith('/admin/outreach/agents/setup')
  return (
    pathname.startsWith('/admin/pipeline') ||
    pathname.startsWith('/admin/records') ||
    pathname.startsWith('/admin/outreach/aspire') ||
    (pathname.startsWith('/admin/outreach/agents') && !isSdrSetupWizard)
  )
}
