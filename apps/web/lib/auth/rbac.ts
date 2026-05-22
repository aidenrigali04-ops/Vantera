import {
  ADMIN_ROUTE_MIN_RANK,
  ROLE_RANK,
  type UserRole,
} from '@/lib/auth/constants'

export function getRequiredRoleRank(pathname: string): number {
  for (const route of ADMIN_ROUTE_MIN_RANK) {
    if (pathname.startsWith(route.prefix)) {
      return route.minRank
    }
  }

  return 0
}

export function hasMinimumRole(role: UserRole, requiredRank: number): boolean {
  if (requiredRank === 0) {
    return true
  }

  return (ROLE_RANK[role] ?? 0) >= requiredRank
}

export function canAccessAdminRoute(role: UserRole, pathname: string): boolean {
  return hasMinimumRole(role, getRequiredRoleRank(pathname))
}
