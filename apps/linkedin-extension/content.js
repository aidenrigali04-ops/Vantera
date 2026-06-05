chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'VANTERA_FILL' || !message.task) return

  const text = message.task.message
  let attempts = 0
  const timer = setInterval(() => {
    attempts += 1
    if (attempts > 40) {
      clearInterval(timer)
      return
    }
    if (tryFillConnectionNote(text)) clearInterval(timer)
  }, 500)
})

function tryFillConnectionNote(text) {
  const textarea =
    document.querySelector('textarea[name="message"]') ||
    document.querySelector('#custom-message') ||
    document.querySelector('textarea[aria-label*="message" i]') ||
    document.querySelector('div[contenteditable="true"][role="textbox"]')

  if (!textarea) return false

  if (textarea instanceof HTMLTextAreaElement) {
    if (textarea.value && textarea.value.trim()) return true
    textarea.focus()
    textarea.value = text
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  if (textarea.isContentEditable) {
    if (textarea.textContent && textarea.textContent.trim()) return true
    textarea.focus()
    textarea.textContent = text
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  return false
}
