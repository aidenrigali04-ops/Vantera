/** Fixed demo workspace name shown during first-session exploration. */
export const DEMO_WORKSPACE_NAME = 'Acme Agency'

/** Temporary banner dismiss duration for "Keep exploring". */
export const BANNER_EXPLORE_DISMISS_MS = 10 * 60 * 1000

/** Auto-open the setup choice modal after this long in the demo workspace. */
export const ONBOARDING_AUTO_PROMPT_MS = 3 * 60 * 1000

/** Show the dashboard "Start here" sidebar badge for this long after clean slate. */
export const START_HERE_BADGE_MS = 3 * 24 * 60 * 60 * 1000

export function bannerExploreDismissKey(accountId: string): string {
  return `vantera_banner_explore_until_${accountId}`
}

export function bannerSampleKeptKey(accountId: string): string {
  return `vantera_banner_sample_kept_${accountId}`
}

export function choiceAutoPromptSeenKey(accountId: string): string {
  return `vantera_choice_autoprompt_seen_${accountId}`
}

export function startHereBadgeUntilKey(accountId: string): string {
  return `vantera_start_here_until_${accountId}`
}
