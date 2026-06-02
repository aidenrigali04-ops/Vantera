export type VentoraMetricIcon = 'trophy' | 'grid' | 'calendar'

export type VentoraMetric = {
  label: string
  value: string
  iconName: VentoraMetricIcon
}

export type VentoraMonthlyPoint = {
  month: string
  solid: number
  hatch: number
}

export type VentoraCampaignStatus = 'active' | 'paused'

export type VentoraCampaignRow = {
  id: string
  name: string
  channels: ('linkedin' | 'email')[]
  scheduled: string
  status: VentoraCampaignStatus
  conversionRate: number
  checked?: boolean
  nested?: boolean
  href: string
}

export type VentoraCampaignGroup = {
  id: string
  name: string
  count: number
  rows: VentoraCampaignRow[]
}

export type VentoraDashboardPayload = {
  metrics: VentoraMetric[]
  chartData: VentoraMonthlyPoint[]
  highlightMonth: string
  aiHeadline: string
  aiBody: string
  aiProgress: number
  campaignGroups: VentoraCampaignGroup[]
}
