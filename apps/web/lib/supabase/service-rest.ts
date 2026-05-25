/**
 * PostgREST reads/writes via native fetch — no @supabase/supabase-js client init,
 * so no Realtime / ws requirement on Vercel Node 20.
 */

function getServiceCredentials(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  const key = rawKey?.trim()

  if (!url || !key) {
    throw new Error(
      'Supabase service credentials are not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
    )
  }

  return { url, key }
}

type RestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string>
  body?: unknown
  prefer?: string
}

export async function supabaseServiceRest<T>(
  table: string,
  options: RestOptions = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { url, key } = getServiceCredentials()
  const params = new URLSearchParams(options.query)
  const endpoint = `${url}/rest/v1/${table}${params.size > 0 ? `?${params.toString()}` : ''}`

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  }

  const method = options.method ?? 'GET'

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.prefer) {
    headers.Prefer = options.prefer
  } else if (method === 'PATCH') {
    headers.Prefer = 'return=minimal'
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    }
  }

  if (!response.ok) {
    let message = response.statusText
    try {
      const payload = (await response.json()) as { message?: string; error?: string }
      message = payload.message ?? payload.error ?? message
    } catch {
      // ignore parse errors
    }
    return { data: null, error: message, status: response.status }
  }

  if (response.status === 204) {
    return { data: null, error: null, status: response.status }
  }

  try {
    const data = (await response.json()) as T
    return { data, error: null, status: response.status }
  } catch {
    return { data: null, error: null, status: response.status }
  }
}

export async function supabaseServiceRestSingle<T>(
  table: string,
  query: Record<string, string>,
): Promise<{ data: T | null; error: string | null }> {
  const result = await supabaseServiceRest<T[]>(table, {
    query: { ...query, limit: '1' },
  })

  if (result.error) {
    return { data: null, error: result.error }
  }

  const rows = result.data
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { data: null, error: null }
  }

  return { data: rows[0] ?? null, error: null }
}
