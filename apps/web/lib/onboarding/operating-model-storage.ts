import type { OperatingModelId } from '@/lib/onboarding/operating-models'

export function operatingModelStorageKey(accountId: string): string {
  return `vantera_operating_model_${accountId}`
}

export function hasSelectedOperatingModel(accountId: string): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(operatingModelStorageKey(accountId)))
}

export function readOperatingModelId(accountId: string): OperatingModelId | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(operatingModelStorageKey(accountId))
  return raw as OperatingModelId | null
}

export const OPERATING_MODEL_CHANGED_EVENT = 'vantera:operating-model-changed'

export function writeOperatingModelId(accountId: string, modelId: OperatingModelId): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(operatingModelStorageKey(accountId), modelId)
  window.dispatchEvent(
    new CustomEvent(OPERATING_MODEL_CHANGED_EVENT, { detail: { accountId, modelId } }),
  )
}
