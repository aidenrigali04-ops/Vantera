'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { connectCrmIntegration, disconnectCrmIntegration } from '@/lib/integrations/connect'
import { findCrmConnections } from '@/lib/integrations/queries'
import { importLeadsFromCrm, exportLeadsToCrm } from '@/lib/integrations/sync/leads'
import type { CrmProvider, CrmSyncResult } from '@/lib/integrations/types'
import { isCrmProvider } from '@/lib/integrations/types'
import { revalidatePath } from 'next/cache'

type ConnectPayload = Record<string, string>

export async function getCrmConnectionsAction() {
  const session = await requireAdminSession()
  return findCrmConnections(session.accountId)
}

export async function connectCrmAction(
  provider: string,
  credentials: ConnectPayload,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!isCrmProvider(provider)) {
    return { success: false, error: 'Unknown CRM provider' }
  }

  const result = await connectCrmIntegration(session.accountId, provider, credentials)
  if (!result.ok) return { success: false, error: result.reason }

  revalidatePath('/admin/integrations')
  revalidatePath('/admin/pipeline')
  return { success: true, data: undefined }
}

export async function disconnectCrmAction(provider: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!isCrmProvider(provider)) {
    return { success: false, error: 'Unknown CRM provider' }
  }

  await disconnectCrmIntegration(session.accountId, provider)
  revalidatePath('/admin/integrations')
  return { success: true, data: undefined }
}

export async function importCrmLeadsAction(
  provider: string,
  limit = 100,
): Promise<ActionResult<CrmSyncResult>> {
  const session = await requireAdminSession()
  if (!isCrmProvider(provider)) {
    return { success: false, error: 'Unknown CRM provider' }
  }

  const result = await importLeadsFromCrm(
    session.accountId,
    session.userId,
    provider,
    limit,
  )

  revalidatePath('/admin/pipeline')
  revalidatePath('/admin/dashboard')
  return { success: true, data: result }
}

export async function exportCrmLeadsAction(
  provider: string,
  leadIds?: string[],
): Promise<ActionResult<CrmSyncResult>> {
  const session = await requireAdminSession()
  if (!isCrmProvider(provider)) {
    return { success: false, error: 'Unknown CRM provider' }
  }

  const result = await exportLeadsToCrm(
    session.accountId,
    session.userId,
    provider,
    leadIds,
  )

  revalidatePath('/admin/pipeline')
  return { success: true, data: result }
}
