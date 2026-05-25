export type TestStatus = 'pass' | 'fail' | 'skip'

export type FailureCategory =
  | 'auth'
  | 'database'
  | 'api'
  | 'edge'
  | 'trigger'
  | 'ui'
  | 'automation'
  | 'config'

export type FixCategory = 'code_fix' | 'config_fix' | 'schema_fix' | 'trigger_fix' | 'dependency_fix'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface DebugScope {
  triggeredBy: 'user_report' | 'deployment' | 'scheduled' | 'auto-detect'
  suspectLayers: Array<'api' | 'auth' | 'db' | 'edge_fn' | 'trigger_job' | 'ui'>
  targetVertical: 'hvac' | 'landscaping' | 'agency' | 'property_mgmt' | 'real_estate' | 'all'
  environment: 'production' | 'preview' | 'local'
  knownError?: string
}

export interface TestResult {
  id: string
  module: string
  name: string
  status: TestStatus
  category: FailureCategory
  severity: Severity
  error?: string
  details?: Record<string, unknown>
  fixable: boolean
  fixId?: string
}

export interface AppliedFix {
  testId: string
  fixId: string
  description: string
  success: boolean
  error?: string
}

export interface DebugRunReport {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  scope: DebugScope
  results: TestResult[]
  fixes: AppliedFix[]
  unresolved: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    fixed: number
    unresolved: number
  }
  formattedReport: string
}
