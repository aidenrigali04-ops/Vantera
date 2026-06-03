import type { LeadQualityTier } from '@/lib/leads/enrichment'

export type QualityUiToken = {
  label: string
  tone: 'success' | 'accent' | 'warning' | 'neutral'
  barColor: string
  mutedBg: string
  ring: string
}

const TIER_UI: Record<LeadQualityTier, QualityUiToken> = {
  excellent: {
    label: 'Excellent',
    tone: 'success',
    barColor: 'var(--success)',
    mutedBg: 'var(--success-muted)',
    ring: 'rgba(46, 204, 113, 0.35)',
  },
  strong: {
    label: 'Strong',
    tone: 'accent',
    barColor: 'var(--accent)',
    mutedBg: 'var(--accent-muted)',
    ring: 'var(--accent-border)',
  },
  moderate: {
    label: 'Moderate',
    tone: 'warning',
    barColor: 'var(--warning)',
    mutedBg: 'var(--warning-muted)',
    ring: 'rgba(243, 156, 18, 0.35)',
  },
  weak: {
    label: 'Weak',
    tone: 'neutral',
    barColor: 'var(--text-tertiary)',
    mutedBg: 'var(--bg-subtle)',
    ring: 'var(--border-default)',
  },
}

export function qualityUiForTier(tier: LeadQualityTier): QualityUiToken {
  return TIER_UI[tier] ?? TIER_UI.moderate
}

export function qualityTierFromIcpOnly(icpScore: number): LeadQualityTier {
  if (icpScore >= 80) return 'excellent'
  if (icpScore >= 65) return 'strong'
  if (icpScore >= 45) return 'moderate'
  return 'weak'
}
