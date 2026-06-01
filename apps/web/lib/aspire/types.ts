export interface ApolloSearchFilters {
  jobTitles: string[]
  industries: string[]
  companySizeRanges: string[]
  locations: string[]
  keywords?: string[]
  contactEmailStatus?: string[]
  /** Legacy UI fields — mapped into keywords/company search */
  q?: string
  company?: string
}

export interface ApolloPersonResult {
  id: string
  firstName: string
  lastName: string
  title: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  organizationName: string
  organizationId: string | null
  websiteUrl: string | null
  city: string | null
  state: string | null
  employeeCount: number | null
  revenue: number | null
  industry: string | null
  technologies: string[]
  photoUrl: string | null
}

export interface ICPConfig {
  targetTitles: string[]
  targetIndustries: string[]
  targetSizes: [number, number]
  targetRevenue?: [number, number]
  mustHaveEmail: boolean
  mustHavePhone: boolean
  bonusTechnologies?: string[]
}

export interface ICPScoreResult {
  score: number
  breakdown: {
    titleMatch: number
    industryMatch: number
    sizeMatch: number
    contactQuality: number
    techBonus: number
  }
  signals: string[]
}

export interface DraftResult {
  channel: 'email' | 'sms'
  subject?: string
  body: string
  metadata: {
    segmentKey: string
    icpScore: number
    triggers: string[]
  }
}

export interface EnrollResult {
  contactId: string
  recordId: string
  leadId: string
  draftIds: string[]
  icpScore: number
  jobId: string | null
}

/** UI-facing search row — includes ICP score from scoring engine */
export type AspireSearchResult = ApolloPersonResult & {
  icpScore: number
  icpSignals: string[]
  /** @deprecated use icpScore */
  intentScore: number
  /** @deprecated use organizationName */
  company: string
}
