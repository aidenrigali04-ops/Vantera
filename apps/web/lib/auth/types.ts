import type { UserRole } from '@/lib/auth/constants'

export type AdminSession = {
  type: 'admin'
  userId: string
  accountId: string
  role: UserRole
  email: string
}

export type PortalSession = {
  type: 'portal'
  contactId: string
  accountId: string
  email: string
}

export type SessionPayload = AdminSession | PortalSession

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
