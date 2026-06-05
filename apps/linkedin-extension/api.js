async function vanteraExtensionFetch(cfg, path, init) {
  const base = cfg.apiBaseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
      ...(init.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data
}

async function vanteraFetchQueue(cfg) {
  return vanteraExtensionFetch(cfg, '/api/extension/linkedin/queue')
}

async function vanteraSendHeartbeat(cfg) {
  return vanteraExtensionFetch(cfg, '/api/extension/linkedin/heartbeat', {
    method: 'POST',
    body: '{}',
  })
}

async function vanteraFetchConfig(cfg) {
  return vanteraExtensionFetch(cfg, '/api/extension/linkedin/config')
}

async function vanteraCompleteStep(cfg, body) {
  return vanteraExtensionFetch(cfg, '/api/extension/linkedin/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
