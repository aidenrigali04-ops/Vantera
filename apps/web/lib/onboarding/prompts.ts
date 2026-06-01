import {
  ONBOARDING_AUTO_PROMPT_MS,
  START_HERE_BADGE_MS,
  choiceAutoPromptSeenKey,
  startHereBadgeUntilKey,
} from './constants'

export function hasSeenChoiceAutoPrompt(accountId: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(choiceAutoPromptSeenKey(accountId)) === 'true'
}

export function markChoiceAutoPromptSeen(accountId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(choiceAutoPromptSeenKey(accountId), 'true')
}

export { ONBOARDING_AUTO_PROMPT_MS }

export function activateStartHereBadge(accountId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    startHereBadgeUntilKey(accountId),
    String(Date.now() + START_HERE_BADGE_MS),
  )
}

export function isStartHereBadgeActive(accountId: string): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(startHereBadgeUntilKey(accountId))
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until) || Date.now() >= until) {
    window.localStorage.removeItem(startHereBadgeUntilKey(accountId))
    return false
  }
  return true
}
