const els = {
  status: document.getElementById('status'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  token: document.getElementById('token'),
  save: document.getElementById('save'),
  queuePanel: document.getElementById('queue-panel'),
  modeLine: document.getElementById('mode-line'),
  pacingLine: document.getElementById('pacing-line'),
  queueCount: document.getElementById('queue-count'),
  queuePreview: document.getElementById('queue-preview'),
  openNext: document.getElementById('open-next'),
  markSent: document.getElementById('mark-sent'),
  error: document.getElementById('error'),
}

function showError(msg) {
  els.error.hidden = !msg
  els.error.textContent = msg || ''
}

function cfgFromForm() {
  return {
    apiBaseUrl: els.apiBaseUrl.value.trim(),
    token: els.token.value.trim(),
  }
}

async function refreshQueue() {
  const cfg = cfgFromForm()
  const [config, queue] = await Promise.all([
    vanteraFetchConfig(cfg),
    vanteraFetchQueue(cfg),
  ])

  await chrome.storage.local.set({ outreachMode: config.outreachMode })

  const modeLabel = config.outreachMode === 'automatic' ? 'Automatic' : 'Review before send'
  els.status.textContent = `Connected · ${modeLabel}`
  els.queuePanel.hidden = false
  els.modeLine.textContent = `Outreach mode: ${modeLabel}`
  els.pacingLine.textContent = `Sent today: ${queue.pacing.dailySent} of ${queue.pacing.dailyLimit}`
  els.queueCount.textContent = `${queue.items.length} message(s) waiting`
  els.queuePreview.innerHTML = ''
  for (const item of queue.items.slice(0, 5)) {
    const li = document.createElement('li')
    li.textContent = `${item.leadName} (${item.source})`
    els.queuePreview.appendChild(li)
  }
}

els.save.addEventListener('click', async () => {
  showError('')
  const cfg = cfgFromForm()
  if (!cfg.apiBaseUrl || !cfg.token) {
    showError('Enter your Vantera web address and connection code')
    return
  }
  try {
    await chrome.storage.local.set(cfg)
    await vanteraSendHeartbeat(cfg)
    await refreshQueue()
  } catch (error) {
    showError(String(error))
  }
})

els.openNext.addEventListener('click', async () => {
  showError('')
  try {
    const res = await chrome.runtime.sendMessage({ type: 'VANTERA_OPEN_NEXT' })
    if (!res?.ok) throw new Error(res?.error || 'Failed')
  } catch (error) {
    showError(String(error))
  }
})

els.markSent.addEventListener('click', async () => {
  showError('')
  try {
    const res = await chrome.runtime.sendMessage({ type: 'VANTERA_COMPLETE_ACTIVE' })
    if (!res?.ok) throw new Error(res?.error || 'Failed')
    await refreshQueue()
  } catch (error) {
    showError(String(error))
  }
})

chrome.storage.local.get(['apiBaseUrl', 'token']).then((stored) => {
  if (stored.apiBaseUrl) els.apiBaseUrl.value = stored.apiBaseUrl
  if (stored.token) els.token.value = stored.token
  if (stored.apiBaseUrl && stored.token) {
    refreshQueue().catch((error) => showError(String(error)))
  }
})
