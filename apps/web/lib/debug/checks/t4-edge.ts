import type { TestResult } from '../types'
import { probeAppHealth } from '../utils'

export async function runEdgeChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // T4.2 — Vercel serverless health (proxy via health route)
  try {
    const probe = await probeAppHealth()
    results.push({
      id: 'T4.2',
      module: 'T4',
      name: 'Serverless functions reachable',
      status: probe ? 'pass' : 'fail',
      category: 'edge',
      severity: 'high',
      error: probe
        ? undefined
        : 'App unreachable — start dev server or set INTERNAL_API_BASE_URL to a deployed URL',
      details: probe ? { baseUrl: probe.baseUrl } : undefined,
      fixable: !probe,
      fixId: probe ? undefined : 'probe_app_urls',
    })
  } catch (error) {
    results.push({
      id: 'T4.2',
      module: 'T4',
      name: 'Serverless functions reachable',
      status: 'fail',
      category: 'edge',
      severity: 'high',
      error: error instanceof Error ? error.message : 'unknown',
      fixable: true,
      fixId: 'probe_app_urls',
    })
  }

  results.push({
    id: 'T4.1',
    module: 'T4',
    name: 'Supabase edge function cold start',
    status: 'skip',
    category: 'edge',
    severity: 'medium',
    error: 'Edge functions not deployed — enable when signal-evaluator is live',
    fixable: false,
  })

  return results
}

export async function rerunEdgeTest(testId: string): Promise<TestResult | null> {
  const all = await runEdgeChecks()
  return all.find((t) => t.id === testId) ?? null
}
