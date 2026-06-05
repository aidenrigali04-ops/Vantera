importScripts('api.js')

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('vantera-heartbeat', { periodInMinutes: 1 })
  chrome.alarms.create('vantera-queue-poll', { periodInMinutes: 2 })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const cfg = await getStoredConfig()
  if (!cfg.token || !cfg.apiBaseUrl) return

  try {
    if (alarm.name === 'vantera-heartbeat') {
      await vanteraSendHeartbeat(cfg)
    }
    if (alarm.name === 'vantera-queue-poll') {
      await maybeAutoOpenNext(cfg)
    }
  } catch (error) {
    console.warn('[vantera-linkedin]', error)
  }
})

async function getStoredConfig() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'token', 'outreachMode', 'activeTask'])
  return {
    apiBaseUrl: stored.apiBaseUrl || '',
    token: stored.token || '',
    outreachMode: stored.outreachMode || 'manual',
    activeTask: stored.activeTask || null,
  }
}

async function maybeAutoOpenNext(cfg) {
  if (cfg.outreachMode !== 'automatic') return
  if (cfg.activeTask) return

  const queue = await vanteraFetchQueue(cfg)
  if (!queue.pacing?.canSend) return
  const next = queue.items && queue.items[0]
  if (!next) return

  await openTask(next)
}

async function openTask(task) {
  const tab = await chrome.tabs.create({ url: task.linkedinUrl, active: true })
  await chrome.storage.local.set({ activeTabId: tab.id, activeTask: task })
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { type: 'VANTERA_FILL', task }).catch(() => {})
  }, 3500)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'VANTERA_COMPLETE_ACTIVE') {
    completeActive()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }
  if (message.type === 'VANTERA_OPEN_NEXT') {
    openNext()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }
  return false
})

async function completeActive() {
  const cfg = await getStoredConfig()
  const stored = await chrome.storage.local.get(['activeTask'])
  const task = stored.activeTask
  if (!task) throw new Error('No active task')

  await vanteraCompleteStep(cfg, { stepId: task.id, source: task.source })
  await chrome.storage.local.remove(['activeTask', 'activeTabId'])
  return { stepId: task.id }
}

async function openNext() {
  const cfg = await getStoredConfig()
  const queue = await vanteraFetchQueue(cfg)
  const next = queue.items && queue.items[0]
  if (!next) throw new Error('Queue empty')
  await openTask(next)
}
