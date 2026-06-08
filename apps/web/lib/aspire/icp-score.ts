import type { ProspectLead, ICPConfig, ICPScoreResult } from '@/lib/aspire/types'

const OWNER_TITLES = ['owner', 'founder', 'ceo', 'president', 'co-founder', 'principal']
const SENIOR_TITLES = ['vp', 'vice president', 'director', 'managing partner', 'head of']

export const DEFAULT_ICP_CONFIGS: Record<string, ICPConfig> = {
  hvac: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'President', 'General Manager'],
    targetIndustries: ['hvac', 'heating', 'air conditioning', 'mechanical'],
    targetSizes: [5, 200],
    mustHaveEmail: true,
    mustHavePhone: false,
    bonusTechnologies: ['ServiceTitan', 'Housecall Pro'],
  },
  landscaping: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'President'],
    targetIndustries: ['landscaping', 'lawn care', 'grounds'],
    targetSizes: [3, 150],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
  plumbing: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'President', 'General Manager'],
    targetIndustries: ['plumbing', 'mechanical', 'facilities'],
    targetSizes: [5, 200],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
  construction: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'President', 'Project Manager'],
    targetIndustries: ['construction', 'general contractor', 'building'],
    targetSizes: [10, 500],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
  property_mgmt: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'President', 'Property Manager'],
    targetIndustries: ['property management', 'real estate', 'facilities'],
    targetSizes: [5, 300],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
  real_estate: {
    targetTitles: ['Owner', 'Founder', 'CEO', 'Broker', 'Team Lead'],
    targetIndustries: ['real estate', 'brokerage', 'property'],
    targetSizes: [2, 100],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
  agency: {
    targetTitles: ['Founder', 'CEO', 'Owner', 'President', 'Managing Director'],
    targetIndustries: ['marketing', 'advertising', 'agency', 'digital'],
    targetSizes: [3, 100],
    mustHaveEmail: true,
    mustHavePhone: false,
  },
}

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

function scoreTitleMatch(title: string, config: ICPConfig): { points: number; signal?: string } {
  const t = normalize(title)
  for (const target of config.targetTitles) {
    if (t.includes(normalize(target))) {
      if (OWNER_TITLES.some((o) => t.includes(o))) {
        return { points: 30, signal: `${target} title match` }
      }
      return { points: 20, signal: `${target} title match` }
    }
  }
  if (SENIOR_TITLES.some((s) => t.includes(s))) {
    return { points: 20, signal: 'Senior title match' }
  }
  if (config.targetTitles.some((target) => t.split(' ').some((word) => normalize(target).includes(word)))) {
    return { points: 10, signal: 'Department keyword match' }
  }
  return { points: 0 }
}

function scoreIndustryMatch(industry: string | null, config: ICPConfig): { points: number; signal?: string } {
  if (!industry) return { points: 0 }
  const i = normalize(industry)
  for (const target of config.targetIndustries) {
    if (i.includes(normalize(target)) || normalize(target).includes(i)) {
      return { points: 25, signal: `${target} industry match` }
    }
  }
  return { points: 0 }
}

function scoreSizeMatch(count: number | null, config: ICPConfig): { points: number; signal?: string } {
  if (count == null) return { points: 0 }
  const [min, max] = config.targetSizes
  if (count >= min && count <= max) {
    return { points: 20, signal: 'Company size in target range' }
  }
  if (count >= min / 2 && count <= max * 2) {
    return { points: 10, signal: 'Company size near target range' }
  }
  return { points: 0 }
}

function scoreContactQuality(person: ProspectLead): { points: number; signals: string[] } {
  let points = 0
  const signals: string[] = []
  if (person.email) {
    points += 8
    signals.push('Has email')
  }
  if (person.phone) {
    points += 5
    signals.push('Has phone')
  }
  if (person.linkedinUrl) {
    points += 2
    signals.push('Has LinkedIn')
  }
  return { points, signals }
}

function scoreTechBonus(person: ProspectLead, config: ICPConfig): { points: number; signals: string[] } {
  const bonus = config.bonusTechnologies ?? []
  if (bonus.length === 0 || person.technologies.length === 0) return { points: 0, signals: [] }

  const signals: string[] = []
  let matches = 0
  for (const tech of bonus) {
    if (person.technologies.some((t) => normalize(t).includes(normalize(tech)))) {
      matches++
      signals.push(`Uses ${tech}`)
    }
  }
  return { points: Math.min(matches * 2, 10), signals }
}

export function scoreICP(person: ProspectLead, config: ICPConfig): ICPScoreResult {
  const title = scoreTitleMatch(person.title, config)
  const industry = scoreIndustryMatch(person.industry, config)
  const size = scoreSizeMatch(person.employeeCount, config)
  const contact = scoreContactQuality(person)
  const tech = scoreTechBonus(person, config)

  const breakdown = {
    titleMatch: title.points,
    industryMatch: industry.points,
    sizeMatch: size.points,
    contactQuality: contact.points,
    techBonus: tech.points,
  }

  const signals = [
    ...(title.signal ? [title.signal] : []),
    ...(industry.signal ? [industry.signal] : []),
    ...(size.signal ? [size.signal] : []),
    ...contact.signals,
    ...tech.signals,
  ]

  if (config.mustHaveEmail && !person.email) {
    breakdown.contactQuality = Math.max(0, breakdown.contactQuality - 8)
  }

  const score = Math.min(
    100,
    breakdown.titleMatch +
      breakdown.industryMatch +
      breakdown.sizeMatch +
      breakdown.contactQuality +
      breakdown.techBonus,
  )

  return { score, breakdown, signals }
}

export function getIcpConfigForVertical(vertical: string): ICPConfig {
  return DEFAULT_ICP_CONFIGS[vertical] ?? DEFAULT_ICP_CONFIGS.agency!
}
