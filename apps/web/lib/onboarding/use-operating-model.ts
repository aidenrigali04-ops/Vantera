'use client'

import {
  getDefaultOperatingModel,
  getOperatingModel,
  type OperatingModel,
} from '@/lib/onboarding/operating-models'
import {
  OPERATING_MODEL_CHANGED_EVENT,
  readOperatingModelId,
} from '@/lib/onboarding/operating-model-storage'
import { useEffect, useState } from 'react'

function resolveOperatingModel(accountId: string): OperatingModel {
  const id = readOperatingModelId(accountId)
  return getOperatingModel(id) ?? getDefaultOperatingModel()
}

export function useOperatingModel(accountId: string): OperatingModel {
  const [model, setModel] = useState<OperatingModel>(() => getDefaultOperatingModel())

  useEffect(() => {
    setModel(resolveOperatingModel(accountId))

    function onChanged(event: Event) {
      const detail = (event as CustomEvent<{ accountId: string }>).detail
      if (detail?.accountId !== accountId) return
      setModel(resolveOperatingModel(accountId))
    }

    window.addEventListener(OPERATING_MODEL_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(OPERATING_MODEL_CHANGED_EVENT, onChanged)
  }, [accountId])

  return model
}
