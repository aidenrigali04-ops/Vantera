export type InsightSeverity = 'red' | 'yellow' | 'green'

export type EmbeddedInsight = {
  id: string
  headline: string
  recommendation: string
  severity: InsightSeverity
  actionLabel: string | null
  actionHref: string
  /** DB signal rows can be dismissed permanently; derived insights are session-only. */
  dismissible: boolean
  source: 'signal' | 'derived'
}
