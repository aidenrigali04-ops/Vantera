import type { TestResult } from '../types'
import { buildDebugAuthHeaders } from '../api-auth'
import { fetchAppPath, probeAppHealth } from '../utils'

type JsonBody = {
  success?: boolean
  data?: unknown
  error?: string
  meta?: unknown
}

async function readJson(response: Response): Promise<JsonBody> {
  try {
    return (await response.json()) as JsonBody
  } catch {
    return {}
  }
}

export async function runApiChecks(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // T3.0 — Health endpoint (probes multiple base URLs)
  try {
    const probe = await probeAppHealth()
    if (!probe) {
      results.push({
        id: 'T3.0',
        module: 'T3',
        name: 'Health endpoint responds',
        status: 'fail',
        category: 'api',
        severity: 'high',
        error: 'App unreachable — start dev server or set INTERNAL_API_BASE_URL to a deployed URL',
        fixable: true,
        fixId: 'probe_app_urls',
      })
    } else {
      const body = (await probe.response.json()) as { ok?: boolean }
      results.push({
        id: 'T3.0',
        module: 'T3',
        name: 'Health endpoint responds',
        status: body.ok === true ? 'pass' : 'fail',
        category: 'api',
        severity: 'high',
        error: body.ok === true ? undefined : 'Health body missing ok:true',
        details: { baseUrl: probe.baseUrl },
        fixable: false,
      })
    }
  } catch (error) {
    results.push({
      id: 'T3.0',
      module: 'T3',
      name: 'Health endpoint responds',
      status: 'fail',
      category: 'api',
      severity: 'high',
      error: error instanceof Error ? error.message : 'fetch failed',
      fixable: true,
      fixId: 'probe_app_urls',
    })
  }

  const appReachable = Boolean(await probeAppHealth().catch(() => null))

  // T3.6 — Session cookie required on app API routes
  if (!appReachable) {
    results.push({
      id: 'T3.6',
      module: 'T3',
      name: 'App API session enforcement',
      status: 'skip',
      category: 'api',
      severity: 'high',
      error: 'App unreachable — cannot probe /api/contacts or /api/records',
      fixable: false,
    })
  } else {
    try {
      const [contactsRes, recordsRes] = await Promise.all([
        fetchAppPath('/api/contacts'),
        fetchAppPath('/api/records'),
      ])

      const contacts401 = contactsRes.response.status === 401
      const records401 = recordsRes.response.status === 401

      results.push({
        id: 'T3.6',
        module: 'T3',
        name: 'App API session enforcement',
        status: contacts401 && records401 ? 'pass' : 'fail',
        category: 'api',
        severity: 'critical',
        error:
          contacts401 && records401
            ? undefined
            : `Expected 401 without session — contacts:${contactsRes.response.status} records:${recordsRes.response.status}`,
        details: { baseUrl: contactsRes.baseUrl },
        fixable: false,
      })
    } catch (error) {
      results.push({
        id: 'T3.6',
        module: 'T3',
        name: 'App API session enforcement',
        status: 'fail',
        category: 'api',
        severity: 'critical',
        error: error instanceof Error ? error.message : 'auth probe failed',
        fixable: false,
      })
    }
  }

  const authHeaders = appReachable ? await buildDebugAuthHeaders().catch(() => null) : null

  // T3.1 — Records list + detail smoke (/api/records)
  if (!appReachable) {
    results.push({
      id: 'T3.1',
      module: 'T3',
      name: 'Records CRUD smoke',
      status: 'skip',
      category: 'api',
      severity: 'medium',
      error: 'App unreachable',
      fixable: false,
    })
  } else if (!authHeaders) {
    results.push({
      id: 'T3.1',
      module: 'T3',
      name: 'Records CRUD smoke',
      status: 'skip',
      category: 'api',
      severity: 'medium',
      error: 'No active admin user found — set DEBUG_TEST_ACCOUNT_ID_TEAM or seed a user',
      fixable: false,
    })
  } else {
    try {
      const list = await fetchAppPath('/api/records?limit=5', { headers: authHeaders })
      const listBody = await readJson(list.response)

      if (list.response.status !== 200 || listBody.success !== true || !Array.isArray(listBody.data)) {
        results.push({
          id: 'T3.1',
          module: 'T3',
          name: 'Records CRUD smoke',
          status: 'fail',
          category: 'api',
          severity: 'medium',
          error: listBody.error ?? `GET /api/records → ${list.response.status}`,
          fixable: false,
        })
      } else {
        const first = listBody.data[0] as { id?: string } | undefined
        let detailOk = true
        let detailError: string | undefined

        if (first?.id) {
          const detail = await fetchAppPath(`/api/records?id=${encodeURIComponent(first.id)}`, {
            method: 'POST',
            headers: authHeaders,
          })
          const detailBody = await readJson(detail.response)
          detailOk =
            detail.response.status === 200 &&
            detailBody.success === true &&
            typeof detailBody.data === 'object' &&
            detailBody.data !== null &&
            (detailBody.data as { id?: string }).id === first.id
          if (!detailOk) {
            detailError = detailBody.error ?? `POST /api/records?id= → ${detail.response.status}`
          }
        }

        results.push({
          id: 'T3.1',
          module: 'T3',
          name: 'Records CRUD smoke',
          status: detailOk ? 'pass' : 'fail',
          category: 'api',
          severity: 'medium',
          error: detailOk ? undefined : detailError,
          details: {
            listCount: listBody.data.length,
            testedDetail: Boolean(first?.id),
          },
          fixable: false,
        })
      }
    } catch (error) {
      results.push({
        id: 'T3.1',
        module: 'T3',
        name: 'Records CRUD smoke',
        status: 'fail',
        category: 'api',
        severity: 'medium',
        error: error instanceof Error ? error.message : 'records smoke failed',
        fixable: false,
      })
    }
  }

  // T3.2 — Contacts list smoke (/api/contacts)
  if (!appReachable) {
    results.push({
      id: 'T3.2',
      module: 'T3',
      name: 'Contacts endpoints smoke',
      status: 'skip',
      category: 'api',
      severity: 'medium',
      error: 'App unreachable',
      fixable: false,
    })
  } else if (!authHeaders) {
    results.push({
      id: 'T3.2',
      module: 'T3',
      name: 'Contacts endpoints smoke',
      status: 'skip',
      category: 'api',
      severity: 'medium',
      error: 'No active admin user found — set DEBUG_TEST_ACCOUNT_ID_TEAM or seed a user',
      fixable: false,
    })
  } else {
    try {
      const res = await fetchAppPath('/api/contacts?limit=5', { headers: authHeaders })
      const body = await readJson(res.response)
      const ok =
        res.response.status === 200 &&
        body.success === true &&
        Array.isArray(body.data) &&
        body.meta !== undefined

      results.push({
        id: 'T3.2',
        module: 'T3',
        name: 'Contacts endpoints smoke',
        status: ok ? 'pass' : 'fail',
        category: 'api',
        severity: 'medium',
        error: ok ? undefined : body.error ?? `GET /api/contacts → ${res.response.status}`,
        details: ok ? { count: (body.data as unknown[]).length } : undefined,
        fixable: false,
      })
    } catch (error) {
      results.push({
        id: 'T3.2',
        module: 'T3',
        name: 'Contacts endpoints smoke',
        status: 'fail',
        category: 'api',
        severity: 'medium',
        error: error instanceof Error ? error.message : 'contacts smoke failed',
        fixable: false,
      })
    }
  }

  // Routes not yet exposed at /api/* — keep skipped with clear reason
  for (const [id, name, path] of [
    ['T3.3', 'Automations endpoints smoke', '/api/automations'],
    ['T3.4', 'Intelligence signals smoke', '/api/intelligence/signals'],
    ['T3.5', 'Forecasting endpoint smoke', '/api/forecasting/revenue'],
  ] as const) {
    if (!appReachable) {
      results.push({
        id,
        module: 'T3',
        name,
        status: 'skip',
        category: 'api',
        severity: 'medium',
        error: 'App unreachable',
        fixable: false,
      })
      continue
    }

    try {
      const { response } = await fetchAppPath(path)
      results.push({
        id,
        module: 'T3',
        name,
        status: response.status === 404 ? 'skip' : 'fail',
        category: 'api',
        severity: 'medium',
        error:
          response.status === 404
            ? `${path} not implemented yet (Phase 2+)`
            : `Unexpected ${response.status} from ${path}`,
        fixable: false,
      })
    } catch {
      results.push({
        id,
        module: 'T3',
        name,
        status: 'skip',
        category: 'api',
        severity: 'medium',
        error: `${path} not implemented yet (Phase 2+)`,
        fixable: false,
      })
    }
  }

  return results
}

export async function rerunApiTest(testId: string): Promise<TestResult | null> {
  const all = await runApiChecks()
  return all.find((t) => t.id === testId) ?? null
}
