import type { PortalConfig, PortalSectionId } from '@/lib/portal/portal-config'
import { redirect } from 'next/navigation'

export function assertPortalSectionEnabled(
  config: PortalConfig,
  section: PortalSectionId,
): void {
  if (section === 'overview') {
    if (!config.sections.overview.enabled) redirect('/portal-login')
    return
  }
  if (config.sections[section]?.enabled === false) {
    redirect('/portal')
  }
}
