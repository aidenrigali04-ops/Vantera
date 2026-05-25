const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
]

export function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function avatarColorClass(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length]!
}

export function contactInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?'
}

export function formatUsdFromCents(cents: number, showCents = false): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: showCents ? 2 : 0,
    minimumFractionDigits: showCents ? 2 : 0,
  }).format(dollars)
}

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '—'
  const then = new Date(date).getTime()
  const now = Date.now()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  const days = Math.floor(diffSec / 86400)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  customer: 'Customer',
  tenant: 'Tenant',
  owner: 'Owner',
  agency_client: 'Client',
  buyer: 'Buyer',
  seller: 'Seller',
  landlord: 'Landlord',
}

export const CONTACT_TYPE_COLORS: Record<string, string> = {
  customer: 'bg-blue-50 text-blue-700',
  tenant: 'bg-violet-50 text-violet-700',
  owner: 'bg-amber-50 text-amber-700',
  agency_client: 'bg-emerald-50 text-emerald-700',
  buyer: 'bg-cyan-50 text-cyan-700',
  seller: 'bg-rose-50 text-rose-700',
  landlord: 'bg-stone-100 text-stone-700',
}
