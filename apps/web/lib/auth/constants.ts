export const ADMIN_SESSION_COOKIE = 'v_admin_session'
export const PORTAL_SESSION_COOKIE = 'v_portal_session'

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'technician'
  | 'agent'

export const ROLE_RANK: Record<UserRole, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  staff: 3,
  technician: 2,
  agent: 1,
}

export const ADMIN_ROUTE_MIN_RANK: Array<{ prefix: string; minRank: number }> = [
  { prefix: '/admin/billing', minRank: ROLE_RANK.owner },
  { prefix: '/admin/settings', minRank: ROLE_RANK.admin },
  { prefix: '/admin/help', minRank: ROLE_RANK.admin },
  { prefix: '/admin/team', minRank: ROLE_RANK.manager },
  { prefix: '/admin/automations', minRank: ROLE_RANK.manager },
]
